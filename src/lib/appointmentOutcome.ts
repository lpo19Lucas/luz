import { prisma } from "@/lib/prisma";
import { cancelPendingWhatsAppJobs } from "@/lib/whatsappJobs";
import { recordAppointmentEvent } from "@/lib/appointmentEvents";
import { AppointmentEventType } from "@prisma/client";

/**
 * Desfecho de um atendimento, marcado pelo dono na Agenda depois que o
 * horário começa:
 *  - COMPLETED: cliente foi atendido — entra no faturamento e no ticket médio.
 *  - NO_SHOW: cliente não apareceu — entra na taxa de no-show.
 *  - PENDING: desfaz a marcação (volta pra CONFIRMED), pra corrigir clique errado.
 *
 * Sem isso nenhum agendamento chegava a COMPLETED e as Métricas ficavam
 * zeradas (todo atendimento passado contava como no-show).
 */
export type AppointmentOutcome = "COMPLETED" | "NO_SHOW" | "PENDING";

export type SetOutcomeResult =
  | { ok: true }
  | { ok: false; reason: "NOT_FOUND" | "NOT_STARTED" | "CANCELLED" };

export async function setAppointmentOutcome(params: {
  salonId: string;
  appointmentId: string;
  outcome: AppointmentOutcome;
  now?: Date;
}): Promise<SetOutcomeResult> {
  const { salonId, appointmentId, outcome } = params;
  const now = params.now ?? new Date();

  // Escopo por salão: o dono só mexe em agendamento do próprio salão.
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, salonId },
  });
  if (!appointment) return { ok: false, reason: "NOT_FOUND" };
  if (appointment.status === "CANCELLED") return { ok: false, reason: "CANCELLED" };
  // Não dá pra dizer que alguém foi atendido (ou faltou) antes do horário começar.
  if (outcome !== "PENDING" && appointment.startAt > now) {
    return { ok: false, reason: "NOT_STARTED" };
  }

  const status = outcome === "PENDING" ? "CONFIRMED" : outcome;
  await prisma.appointment.update({ where: { id: appointment.id }, data: { status } });

  // Atendimento encerrado: lembrete/pedido de confirmação que ainda não saiu
  // não faz mais sentido.
  if (outcome !== "PENDING") {
    await cancelPendingWhatsAppJobs(appointment.id);
  }

  const eventType: AppointmentEventType = outcome === "PENDING" ? "OUTCOME_REVERTED" : outcome;
  await recordAppointmentEvent({
    salonId,
    appointmentId: appointment.id,
    type: eventType,
    actor: "OWNER",
  });

  return { ok: true };
}

/** Status que ainda esperam o dono marcar o desfecho depois que o horário passou. */
export const AWAITING_OUTCOME_STATUSES = ["CONFIRMED", "AWAITING_CONFIRMATION"] as const;
