import { Prisma, PrismaClient, AppointmentEventType, AppointmentEventActor } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

/** Registra um evento no histórico do agendamento (F5). */
export async function recordAppointmentEvent(
  data: {
    salonId: string;
    appointmentId: string;
    type: AppointmentEventType;
    actor: AppointmentEventActor;
    previousStartAt?: Date;
    newStartAt?: Date;
    note?: string;
  },
  db: Db = prisma
) {
  await db.appointmentEvent.create({ data });
}

export const EVENT_LABEL: Record<AppointmentEventType, string> = {
  CREATED: "Agendado",
  CANCELLED: "Cancelado",
  RESCHEDULED: "Remarcado",
  PRESENCE_CONFIRMED: "Presença confirmada",
  COMPLETED: "Concluído",
  NO_SHOW: "Não compareceu",
  OUTCOME_REVERTED: "Desfecho desfeito",
};

export const ACTOR_LABEL: Record<AppointmentEventActor, string> = {
  CLIENT: "Cliente",
  OWNER: "Salão",
  SYSTEM: "Automático",
};
