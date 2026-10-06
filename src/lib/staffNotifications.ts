import { after } from "next/server";
import type { AppointmentEventActor, NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isPushConfigured, notify, type PushPayload } from "@/lib/push";
import { formatSalonDate, formatSalonTime, salonCalendarDay } from "@/lib/timezone";
import { getSubscriptionAccess } from "@/lib/subscriptionAccess";

export { STAFF_NOTIFICATION_TYPES } from "@/lib/notificationTypes";

/**
 * Avisos pra equipe do salão (Fase E3): dono e profissional com acesso.
 *
 * - Na hora do evento: novo agendamento, cancelamento, remarcação, presença
 *   confirmada (dono + profissional do atendimento), pacote reservado e
 *   avaliação nova (só dono). Quem fez a ação não é avisado dela mesma.
 * - Às 7h (cron): resumo do dia de cada um.
 *
 * Cada pessoa pode desligar tipos em Configurações (User.mutedNotifications).
 */


/**
 * Roda depois da resposta (after) — notificação nunca atrasa nem derruba o
 * agendamento. Desligado nos testes (tests/integration/env.ts): o after() do
 * Next executa a tarefa mesmo fora de uma request, e uma tarefa solta corre
 * contra o reset do banco entre testes — lá as funções são chamadas direto.
 */
export function dispatchInBackground(task: () => Promise<unknown>) {
  if (!isPushConfigured() || process.env.DISABLE_BACKGROUND_NOTIFICATIONS === "1") return;
  const safe = () => task().catch((err) => console.error("[notificações] falha em segundo plano", err));
  try {
    after(safe);
  } catch {
    void safe();
  }
}

type StaffRecipient = { userId: string; role: "OWNER" | "PROFESSIONAL" };

function whenLabel(date: Date) {
  return `${formatSalonDate(date, { weekday: "short", day: "2-digit", month: "2-digit" })} às ${formatSalonTime(date)}`;
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

export type AppointmentEventKind = "CREATED" | "CANCELLED" | "RESCHEDULED" | "PRESENCE_CONFIRMED";

const EVENT_TYPE: Record<AppointmentEventKind, NotificationType> = {
  CREATED: "BOOKING_CREATED",
  CANCELLED: "BOOKING_CANCELLED",
  RESCHEDULED: "BOOKING_RESCHEDULED",
  PRESENCE_CONFIRMED: "PRESENCE_CONFIRMED",
};

/** Texto da notificação de um evento de agendamento (puro — testado à parte). */
export function appointmentEventMessage(params: {
  kind: AppointmentEventKind;
  actor: AppointmentEventActor;
  clientName: string;
  serviceName: string;
  professionalName: string;
  startAt: Date;
  previousStartAt?: Date | null;
  forRole: "OWNER" | "PROFESSIONAL";
}): { title: string; body: string } {
  const client = firstName(params.clientName);
  // O dono vê com quem é; o profissional já sabe que é com ele.
  const what = params.forRole === "OWNER" ? `${params.serviceName} com ${params.professionalName}` : params.serviceName;
  switch (params.kind) {
    case "CREATED":
      return {
        title: params.actor === "CLIENT" ? "Novo agendamento" : "Agendamento marcado pelo salão",
        body: `${client} · ${what} · ${whenLabel(params.startAt)}`,
      };
    case "CANCELLED":
      return {
        title: "Agendamento cancelado",
        body:
          params.actor === "CLIENT"
            ? `${client} cancelou ${what} de ${whenLabel(params.startAt)}`
            : params.actor === "SYSTEM"
              ? `Horário liberado (sem confirmação): ${client} · ${what} · ${whenLabel(params.startAt)}`
              : `Cancelado pelo salão: ${client} · ${what} · ${whenLabel(params.startAt)}`,
      };
    case "RESCHEDULED":
      return {
        title: "Agendamento remarcado",
        body: `${client} · ${what}: ${params.previousStartAt ? `${whenLabel(params.previousStartAt)} → ` : ""}${whenLabel(params.startAt)}`,
      };
    case "PRESENCE_CONFIRMED":
      return { title: "Presença confirmada", body: `${client} confirmou ${what} · ${whenLabel(params.startAt)}` };
  }
}

async function filterMuted(recipients: StaffRecipient[], type: NotificationType) {
  if (recipients.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: recipients.map((r) => r.userId) } },
    select: { id: true, mutedNotifications: true, disabledAt: true },
  });
  const allowed = new Set(users.filter((u) => !u.disabledAt && !u.mutedNotifications.includes(type)).map((u) => u.id));
  return recipients.filter((r) => allowed.has(r.userId));
}

function staffUrl(role: StaffRecipient["role"], startAt?: Date) {
  if (role === "PROFESSIONAL") return "/minha-agenda";
  return startAt ? `/agenda?date=${salonCalendarDay(startAt).toISOString().slice(0, 10)}` : "/agenda";
}

/** Avisa dono e profissional de um evento do agendamento. Devolve quantos foram avisados. */
export async function notifyStaffAboutAppointment(params: {
  appointmentId: string;
  kind: AppointmentEventKind;
  actor: AppointmentEventActor;
  previousStartAt?: Date | null;
}) {
  const appt = await prisma.appointment.findUnique({
    where: { id: params.appointmentId },
    include: {
      salon: { select: { id: true, ownerId: true } },
      professional: { select: { name: true, userId: true, active: true } },
      service: { select: { name: true } },
      client: { select: { name: true } },
    },
  });
  if (!appt) return 0;

  const type = EVENT_TYPE[params.kind];
  let recipients: StaffRecipient[] = [];
  if (params.actor !== "OWNER") recipients.push({ userId: appt.salon.ownerId, role: "OWNER" });
  if (params.actor !== "PROFESSIONAL" && appt.professional.userId && appt.professional.active && appt.professional.userId !== appt.salon.ownerId) {
    recipients.push({ userId: appt.professional.userId, role: "PROFESSIONAL" });
  }
  recipients = await filterMuted(recipients, type);

  for (const r of recipients) {
    const message = appointmentEventMessage({
      kind: params.kind,
      actor: params.actor,
      clientName: appt.client.name,
      serviceName: appt.service.name,
      professionalName: appt.professional.name,
      startAt: appt.startAt,
      previousStartAt: params.previousStartAt,
      forRole: r.role,
    });
    await notify({
      salonId: appt.salon.id,
      recipient: { userId: r.userId },
      type,
      appointmentId: appt.id,
      payload: { ...message, url: staffUrl(r.role, appt.startAt), tag: `appt-${appt.id}` },
    });
  }
  return recipients.length;
}

export async function notifyOwnerAboutPackageReservation(clientPackageId: string) {
  const pkg = await prisma.clientPackage.findUnique({
    where: { id: clientPackageId },
    include: { salon: { select: { id: true, ownerId: true } }, client: { select: { name: true } }, packageDefinition: { select: { name: true } } },
  });
  if (!pkg) return 0;
  const [owner] = await filterMuted([{ userId: pkg.salon.ownerId, role: "OWNER" }], "PACKAGE_RESERVED");
  if (!owner) return 0;
  await notify({
    salonId: pkg.salon.id,
    recipient: { userId: owner.userId },
    type: "PACKAGE_RESERVED",
    payload: {
      title: "Pacote reservado",
      body: `${firstName(pkg.client.name)} reservou "${pkg.packageDefinition.name}" — confirme o pagamento.`,
      url: "/pacotes",
      tag: `pkg-${pkg.id}`,
    },
  });
  return 1;
}

export async function notifyOwnerAboutReview(reviewId: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { salon: { select: { id: true, ownerId: true } }, client: { select: { name: true } } },
  });
  if (!review) return 0;
  const [owner] = await filterMuted([{ userId: review.salon.ownerId, role: "OWNER" }], "REVIEW_RECEIVED");
  if (!owner) return 0;
  const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
  await notify({
    salonId: review.salon.id,
    recipient: { userId: owner.userId },
    type: "REVIEW_RECEIVED",
    payload: {
      title: `Nova avaliação ${stars}`,
      body: review.comment ? `${firstName(review.client.name)}: ${review.comment.slice(0, 120)}` : `${firstName(review.client.name)} avaliou o atendimento.`,
      url: "/avaliacoes",
      tag: `review-${review.id}`,
    },
  });
  return 1;
}

/** Texto do resumo do dia (puro). */
export function dailyAgendaMessage(items: { startAt: Date; clientName: string; serviceName: string }[]): PushPayload | null {
  if (items.length === 0) return null;
  const first = items[0];
  return {
    title: "Sua agenda de hoje",
    body: `${items.length} atendimento${items.length > 1 ? "s" : ""} · primeiro às ${formatSalonTime(first.startAt)} (${firstName(first.clientName)}, ${first.serviceName})`,
    url: "/agenda",
    tag: "agenda-do-dia",
  };
}

/**
 * Cron das 7h: resumo do dia pro dono (todos os atendimentos do salão) e pra
 * cada profissional com acesso (só os dele). Dia sem atendimento não gera
 * aviso. Salão bloqueado por falta de pagamento fica de fora. Idempotente
 * (dedupeKey por pessoa+salão+dia).
 */
export async function sendDailyAgendaDigests(now: Date = new Date()) {
  const day = salonCalendarDay(now);
  const dayKey = day.toISOString().slice(0, 10);
  const start = new Date(day.getTime() + 3 * 60 * 60_000); // 00:00 em Brasília
  const end = new Date(start.getTime() + 24 * 60 * 60_000);

  const appointments = await prisma.appointment.findMany({
    where: { startAt: { gte: start, lt: end }, status: { in: ["CONFIRMED", "AWAITING_CONFIRMATION"] } },
    orderBy: { startAt: "asc" },
    include: {
      salon: { select: { id: true, ownerId: true, subscription: true } },
      professional: { select: { userId: true, active: true } },
      service: { select: { name: true } },
      client: { select: { name: true } },
    },
  });

  // Agrupa por destinatário (dono do salão e profissional do atendimento).
  const groups = new Map<string, { salonId: string; recipient: StaffRecipient; items: typeof appointments }>();
  for (const appt of appointments) {
    if (getSubscriptionAccess(appt.salon.subscription, now) === "BLOCKED") continue;
    const add = (r: StaffRecipient) => {
      const key = `${r.userId}:${appt.salon.id}`;
      const group = groups.get(key) ?? { salonId: appt.salon.id, recipient: r, items: [] };
      group.items.push(appt);
      groups.set(key, group);
    };
    add({ userId: appt.salon.ownerId, role: "OWNER" });
    if (appt.professional.userId && appt.professional.active && appt.professional.userId !== appt.salon.ownerId) {
      add({ userId: appt.professional.userId, role: "PROFESSIONAL" });
    }
  }

  let sent = 0;
  for (const group of groups.values()) {
    const [allowed] = await filterMuted([group.recipient], "DAILY_AGENDA");
    if (!allowed) continue;
    const payload = dailyAgendaMessage(
      group.items.map((a) => ({ startAt: a.startAt, clientName: a.client.name, serviceName: a.service.name }))
    );
    if (!payload) continue;
    const result = await notify({
      salonId: group.salonId,
      recipient: { userId: group.recipient.userId },
      type: "DAILY_AGENDA",
      payload: { ...payload, url: staffUrl(group.recipient.role) },
      dedupeKey: `daily:${group.recipient.userId}:${group.salonId}:${dayKey}`,
    });
    if (result.status === "SENT") sent++;
  }
  return { dailyDigests: sent };
}
