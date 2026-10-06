import webpush from "web-push";
import type { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Web Push (PWA — Fase E2). Envio direto pelos serviços de push dos
 * navegadores (FCM no Chrome/Android, APNs no Safari/iOS), assinado com as
 * chaves VAPID — sem custo por mensagem e sem provedor intermediário.
 *
 * Quem recebe: aparelhos inscritos de um usuário (dono/profissional) ou de um
 * cliente. Cada envio vira uma linha em notification_logs; `dedupeKey`
 * garante que lembretes do cron não saiam duas vezes.
 */

export type PushPayload = {
  title: string;
  body: string;
  /** Pra onde o clique leva (caminho relativo do site). */
  url: string;
  /** Mesma tag substitui a notificação anterior em vez de empilhar. */
  tag?: string;
  icon?: string;
};

export type Recipient = { userId: string } | { clientId: string };

export function isPushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:contato@luz.app",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  vapidConfigured = true;
}

export function recipientKey(r: Recipient) {
  return "userId" in r ? `user:${r.userId}` : `client:${r.clientId}`;
}

// ------------------------------------------------------------
// Inscrições
// ------------------------------------------------------------

export type SubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };

export function isValidSubscription(value: unknown): value is SubscriptionInput {
  const v = value as SubscriptionInput | null;
  return Boolean(
    v &&
      typeof v.endpoint === "string" &&
      /^https:\/\//.test(v.endpoint) &&
      v.endpoint.length < 2048 &&
      typeof v.keys?.p256dh === "string" &&
      typeof v.keys?.auth === "string"
  );
}

/**
 * Salva (ou reassocia) a inscrição deste aparelho. O endpoint é único por
 * navegador — se o mesmo aparelho trocar de dono (ex.: celular do salão usado
 * por outro profissional), a linha passa pro novo destinatário.
 */
export async function saveSubscription(
  sub: SubscriptionInput,
  owner: { salonId: string } & Recipient,
  userAgent?: string | null
) {
  const data = {
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    salonId: owner.salonId,
    userId: "userId" in owner ? owner.userId : null,
    clientId: "clientId" in owner ? owner.clientId : null,
    userAgent: userAgent?.slice(0, 300) ?? null,
    failureCount: 0,
  };
  return prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { endpoint: sub.endpoint, ...data },
    update: data,
  });
}

export async function removeSubscription(endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

// ------------------------------------------------------------
// Envio
// ------------------------------------------------------------

// Depois de tantas falhas seguidas (não 404/410), desiste do aparelho.
const MAX_FAILURES = 5;

async function sendToDevices(
  subs: { id: string; endpoint: string; p256dh: string; auth: string }[],
  payload: PushPayload
) {
  ensureVapid();
  const body = JSON.stringify(payload);
  let delivered = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body, {
          TTL: 60 * 60 * 24,
          urgency: "normal",
        });
        delivered++;
        await prisma.pushSubscription.update({ where: { id: sub.id }, data: { lastSuccessAt: new Date(), failureCount: 0 } });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Aparelho desinscreveu/desinstalou — não adianta tentar de novo.
          await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
          return;
        }
        console.warn(`[push] falha ${status ?? "?"} ao enviar pra ${sub.id}`);
        const updated = await prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { failureCount: { increment: 1 } },
        });
        if (updated.failureCount >= MAX_FAILURES) {
          await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
        }
      }
    })
  );
  return delivered;
}

/**
 * Notifica um destinatário em todos os aparelhos dele (no salão). Nunca
 * lança erro pra quem chamou — notificação não pode derrubar um agendamento.
 * Com `dedupeKey`, só envia uma vez por chave (o cron diário usa isso).
 */
export async function notify(params: {
  salonId: string;
  recipient: Recipient;
  type: NotificationType;
  payload: PushPayload;
  appointmentId?: string;
  dedupeKey?: string;
}): Promise<{ status: "SENT" | "FAILED" | "NO_SUBSCRIPTION" | "DUPLICATE" | "DISABLED"; devices: number }> {
  if (!isPushConfigured()) return { status: "DISABLED", devices: 0 };
  try {
    if (params.dedupeKey) {
      const already = await prisma.notificationLog.findUnique({ where: { dedupeKey: params.dedupeKey } });
      if (already) return { status: "DUPLICATE", devices: 0 };
    }
    const where =
      "userId" in params.recipient
        ? { salonId: params.salonId, userId: params.recipient.userId }
        : { salonId: params.salonId, clientId: params.recipient.clientId };
    const subs = await prisma.pushSubscription.findMany({ where });
    const devices = subs.length ? await sendToDevices(subs, params.payload) : 0;
    const status = subs.length === 0 ? "NO_SUBSCRIPTION" : devices > 0 ? "SENT" : "FAILED";

    try {
      await prisma.notificationLog.create({
        data: {
          salonId: params.salonId,
          appointmentId: params.appointmentId ?? null,
          type: params.type,
          recipient: recipientKey(params.recipient),
          status,
          devices,
          dedupeKey: params.dedupeKey ?? null,
        },
      });
    } catch {
      // Corrida com outra execução usando a mesma dedupeKey — o envio já
      // aconteceu aqui, só não duplica o registro.
    }
    return { status, devices };
  } catch (err) {
    console.error("[push] erro ao notificar", err);
    return { status: "FAILED", devices: 0 };
  }
}
