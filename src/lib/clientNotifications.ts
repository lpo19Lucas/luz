import { prisma } from "@/lib/prisma";
import { notify, type PushPayload } from "@/lib/push";
import { formatSalonDate, formatSalonTime, salonCalendarDay } from "@/lib/timezone";
import { getSubscriptionAccess } from "@/lib/subscriptionAccess";
import { isDiscreetSalon } from "@/lib/discreet";

/**
 * Avisos pro cliente (Fase E4), nos aparelhos que ele inscreveu pelo link do
 * agendamento (o cliente não tem login). Com o cron rodando 1x por dia às
 * 7h (decisão do Lucas), os lembretes são por dia, não por hora:
 *
 * - CLIENT_BOOKING_CONFIRMED: na hora em que ele ativa as notificações
 *   (resposta imediata de que deu certo).
 * - CLIENT_REMINDER_TODAY: às 7h do dia do atendimento.
 * - CLIENT_PRESENCE_CHECK: às 7h da véspera, se o salão pede confirmação e
 *   ele ainda não confirmou — o toque abre a tela de confirmar.
 * - CLIENT_REVIEW_REQUEST: às 7h do dia seguinte a um atendimento concluído
 *   ainda sem avaliação.
 *
 * Quem não tem push fica com o lembrete do .ics e o botão "Lembrar pelo
 * WhatsApp" do dono (E5). O texto nunca leva telefone.
 */

type ApptForMessage = {
  startAt: Date;
  service: { name: string };
  professional: { name: string };
  salon: { name: string; slug: string; segment?: string | null };
  client: { name: string };
  accessToken: string;
};

/** Modo discreto: nada de serviço nem profissional nos avisos (src/lib/discreet.ts). */
function discreetOr(appt: ApptForMessage, discreetText: string, normalText: string) {
  return isDiscreetSalon(appt.salon) ? discreetText : normalText;
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

function base(appt: ApptForMessage, tag: string): Pick<PushPayload, "url" | "icon" | "tag"> {
  return {
    url: `/${appt.salon.slug}/agendamento/${appt.accessToken}`,
    icon: `/pwa-icon?salon=${encodeURIComponent(appt.salon.slug)}&size=192`,
    tag,
  };
}

export function bookingConfirmedMessage(appt: ApptForMessage): PushPayload {
  const day = formatSalonDate(appt.startAt, { weekday: "long", day: "2-digit", month: "2-digit" });
  return {
    title: `${appt.salon.name}: tudo certo!`,
    body: `${firstName(appt.client.name)}, você vai receber o lembrete d${discreetOr(appt, "o seu horário", `o seu ${appt.service.name}`)} (${day} às ${formatSalonTime(appt.startAt)}).`,
    ...base(appt, `appt-${appt.accessToken}`),
  };
}

export function reminderTodayMessage(appt: ApptForMessage): PushPayload {
  return {
    title: `Hoje às ${formatSalonTime(appt.startAt)} · ${appt.salon.name}`,
    body: `${firstName(appt.client.name)}, ${discreetOr(appt, "seu horário", `seu ${appt.service.name} com ${appt.professional.name}`)} é hoje. Precisa remarcar? Toque aqui.`,
    ...base(appt, `appt-${appt.accessToken}`),
  };
}

export function presenceCheckMessage(appt: ApptForMessage): PushPayload {
  return {
    title: `Confirme sua presença · ${appt.salon.name}`,
    body: `${firstName(appt.client.name)}, ${discreetOr(appt, "seu horário", `seu ${appt.service.name}`)} é amanhã às ${formatSalonTime(appt.startAt)}. Toque para confirmar ou remarcar.`,
    ...base(appt, `appt-${appt.accessToken}`),
  };
}

export function reviewRequestMessage(appt: ApptForMessage): PushPayload {
  return {
    title: `Como foi no ${appt.salon.name}?`,
    body: `${firstName(appt.client.name)}, conte como foi seu ${appt.service.name} com ${appt.professional.name} — leva 10 segundos.`,
    ...base(appt, `review-${appt.accessToken}`),
  };
}

const include = {
  service: { select: { name: true } },
  professional: { select: { name: true } },
  client: { select: { id: true, name: true, bannedAt: true } },
  salon: { select: { id: true, name: true, slug: true, segment: true, subscription: true, presenceConfirmationCfg: true } },
} as const;

/** Logo depois de o cliente ativar as notificações pelo link do agendamento. */
export async function sendBookingConfirmedToClient(accessToken: string) {
  const appt = await prisma.appointment.findUnique({ where: { accessToken }, include });
  if (!appt || appt.startAt <= new Date() || !["CONFIRMED", "AWAITING_CONFIRMATION"].includes(appt.status)) return null;
  return notify({
    salonId: appt.salon.id,
    recipient: { clientId: appt.client.id },
    type: "CLIENT_BOOKING_CONFIRMED",
    appointmentId: appt.id,
    payload: bookingConfirmedMessage(appt),
    // Um por horário: remarcou e reativou → nova confirmação.
    dedupeKey: `client-confirmed:${appt.id}:${appt.startAt.toISOString()}`,
  });
}

/** Cron das 7h: lembrete de hoje, confirmação de presença de amanhã e pedido de avaliação de ontem. */
export async function sendClientDailyNotifications(now: Date = new Date()) {
  const dayMs = 24 * 60 * 60_000;
  const todayStart = new Date(salonCalendarDay(now).getTime() + 3 * 60 * 60_000); // 00:00 de Brasília
  const tomorrowStart = new Date(todayStart.getTime() + dayMs);
  const yesterdayStart = new Date(todayStart.getTime() - dayMs);

  const [today, tomorrow, yesterdayDone] = await Promise.all([
    prisma.appointment.findMany({
      where: { startAt: { gte: todayStart, lt: tomorrowStart }, status: { in: ["CONFIRMED", "AWAITING_CONFIRMATION"] } },
      include,
    }),
    prisma.appointment.findMany({
      where: { startAt: { gte: tomorrowStart, lt: new Date(tomorrowStart.getTime() + dayMs) }, status: "AWAITING_CONFIRMATION" },
      include,
    }),
    prisma.appointment.findMany({
      where: { startAt: { gte: yesterdayStart, lt: todayStart }, status: "COMPLETED", review: null },
      include,
    }),
  ]);

  const usable = (a: (typeof today)[number]) =>
    !a.client.bannedAt && getSubscriptionAccess(a.salon.subscription, now) !== "BLOCKED";

  const counts = { clientReminders: 0, clientPresenceChecks: 0, clientReviewRequests: 0 };
  const run = async (
    list: typeof today,
    type: "CLIENT_REMINDER_TODAY" | "CLIENT_PRESENCE_CHECK" | "CLIENT_REVIEW_REQUEST",
    message: (a: ApptForMessage) => PushPayload,
    key: keyof typeof counts
  ) => {
    for (const appt of list.filter(usable)) {
      const result = await notify({
        salonId: appt.salon.id,
        recipient: { clientId: appt.client.id },
        type,
        appointmentId: appt.id,
        payload: message(appt),
        dedupeKey: `${type}:${appt.id}:${appt.startAt.toISOString()}`,
      });
      if (result.status === "SENT") counts[key]++;
    }
  };

  await run(today, "CLIENT_REMINDER_TODAY", reminderTodayMessage, "clientReminders");
  await run(
    tomorrow.filter((a) => a.salon.presenceConfirmationCfg?.enabled),
    "CLIENT_PRESENCE_CHECK",
    presenceCheckMessage,
    "clientPresenceChecks"
  );
  // Modo discreto: sem pedido de avaliação (avaliação pública exporia quem é cliente).
  await run(yesterdayDone.filter((a) => !isDiscreetSalon(a.salon)), "CLIENT_REVIEW_REQUEST", reviewRequestMessage, "clientReviewRequests");
  return counts;
}
