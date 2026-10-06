import { Prisma, PrismaClient, AppointmentSource, AppointmentEventActor } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";
import { getAvailableSlots } from "@/lib/slots";
import { salonCalendarDay } from "@/lib/timezone";
import { getSubscriptionAccess } from "@/lib/subscriptionAccess";
import { recordAppointmentEvent } from "@/lib/appointmentEvents";
import { dispatchInBackground, notifyStaffAboutAppointment } from "@/lib/staffNotifications";
import { cancelPendingWhatsAppJobs } from "@/lib/whatsappJobs";
import { findUsablePackageForAppointment } from "@/lib/packages";

type Db = PrismaClient | Prisma.TransactionClient;

const REMINDER_HOURS_BEFORE = 2;

export type BookingErrorCode =
  | "SALON_NOT_FOUND"
  | "INVALID_SERVICE"
  | "INVALID_PROFESSIONAL"
  | "SLOT_TAKEN"
  | "SLOT_UNAVAILABLE"
  | "CLIENT_BANNED"
  | "NOT_FOUND"
  | "ALREADY_CANCELLED"
  | "ALREADY_FINISHED"
  | "CANNOT_CONFIRM"
  | "CANNOT_RESCHEDULE"
  | "PAST_SLOT"
  | "SALON_NOT_PUBLISHED"
  | "SALON_BLOCKED"
  | "PACKAGE_NOT_USABLE";

/**
 * Erro de negócio do fluxo de agendamento — as rotas e as actions traduzem o
 * `code` pro status HTTP e pra mensagem certa (ver `src/lib/bookingErrors.ts`).
 */
export class BookingError extends Error {
  code: BookingErrorCode;
  constructor(code: BookingErrorCode) {
    super(code);
    this.name = "BookingError";
    this.code = code;
  }
}

/** Profissional precisa pertencer ao salão, estar ativo e fazer esse serviço. */
async function assertProfessionalDoesService(
  db: Db,
  salonId: string,
  professionalId: string,
  serviceId: string
) {
  const professional = await db.professional.findFirst({
    where: { id: professionalId, salonId, active: true, services: { some: { serviceId } } },
  });
  if (!professional) throw new BookingError("INVALID_PROFESSIONAL");
}

/** Mesma checagem de overlap usada na criação e no reagendamento. */
async function assertNoConflict(
  db: Db,
  professionalId: string,
  startAt: Date,
  endAt: Date,
  excludeAppointmentId?: string
) {
  const conflict = await db.appointment.findFirst({
    where: {
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      professionalId,
      status: { not: "CANCELLED" },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
  });
  if (conflict) throw new BookingError("SLOT_TAKEN");
}

/** No fluxo público o cliente só pode escolher um horário que `getAvailableSlots` ofereceu. */
async function assertSlotIsOffered(
  professionalId: string,
  serviceId: string,
  startAt: Date,
  excludeAppointmentId?: string
) {
  const slots = await getAvailableSlots(professionalId, serviceId, salonCalendarDay(startAt), excludeAppointmentId);
  const offered = slots.some((slot) => slot.getTime() === startAt.getTime());
  if (!offered) throw new BookingError("SLOT_UNAVAILABLE");
}

/** Upsert por telefone normalizado (spec seção 6) — recusa cliente banido. */
async function upsertClient(db: Db, salonId: string, name: string, phone: string) {
  const normalized = normalizePhone(phone);
  const existing = await db.client.findUnique({
    where: { salonId_phone: { salonId, phone: normalized } },
  });
  if (existing?.bannedAt) throw new BookingError("CLIENT_BANNED");

  return db.client.upsert({
    where: { salonId_phone: { salonId, phone: normalized } },
    update: { name },
    create: { salonId, name, phone: normalized },
  });
}

async function scheduleReminderJobs(
  db: Db,
  appointment: { id: string; startAt: Date },
  presenceCfg: { enabled: boolean; hoursBefore: number } | null
) {
  await db.whatsAppMessageJob.create({
    data: {
      appointmentId: appointment.id,
      type: "REMINDER",
      scheduledFor: new Date(appointment.startAt.getTime() - REMINDER_HOURS_BEFORE * 60 * 60_000),
    },
  });
  if (presenceCfg?.enabled) {
    await db.whatsAppMessageJob.create({
      data: {
        appointmentId: appointment.id,
        type: "PRESENCE_CHECK",
        scheduledFor: new Date(appointment.startAt.getTime() - presenceCfg.hoursBefore * 60 * 60_000),
      },
    });
  }
}

/**
 * Cria um agendamento — usado pelo fluxo público (`source: "ONLINE"`, horário
 * validado contra `getAvailableSlots`) e pelo agendamento manual do dono
 * (`source: "OWNER"`, B3: encaixe livre que só checa conflito de horário).
 *
 * Transação SERIALIZABLE (arquitetura-modelo-de-dados.md, seção 4): se dois
 * clientes baterem no mesmo horário ao mesmo tempo, o Postgres derruba uma
 * das duas com erro de serialização (P2034), tratado aqui como SLOT_TAKEN.
 */
export async function createAppointment(params: {
  salonSlug: string;
  professionalId: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  startAt: Date;
  wantsToPayNow: boolean;
  source: AppointmentSource;
  actor: AppointmentEventActor;
  usePackageId?: string;
}) {
  const salon = await prisma.salon.findUnique({
    where: { slug: params.salonSlug },
    include: { subscription: true },
  });
  if (!salon) throw new BookingError("SALON_NOT_FOUND");
  // F12: o link público só aceita agendamento depois de publicado. O dono
  // (source OWNER) pode agendar manualmente mesmo antes disso.
  if (params.source === "ONLINE" && !salon.publishedAt) {
    throw new BookingError("SALON_NOT_PUBLISHED");
  }
  // F6: salão bloqueado por falta de pagamento (depois da carência) não
  // aceita agendamento novo pelo link público — os já marcados continuam
  // válidos. O dono ainda pode agendar manualmente.
  if (params.source === "ONLINE" && getSubscriptionAccess(salon.subscription) === "BLOCKED") {
    throw new BookingError("SALON_BLOCKED");
  }

  const service = await prisma.service.findFirst({
    where: { id: params.serviceId, salonId: salon.id },
  });
  if (!service) throw new BookingError("INVALID_SERVICE");

  await assertProfessionalDoesService(prisma, salon.id, params.professionalId, service.id);

  const endAt = new Date(params.startAt.getTime() + service.durationMinutes * 60_000);

  if (params.source === "ONLINE") {
    await assertSlotIsOffered(params.professionalId, service.id, params.startAt);
  }

  try {
    const appointment = await prisma.$transaction(
      async (tx) => {
        await assertNoConflict(tx, params.professionalId, params.startAt, endAt);
        const client = await upsertClient(tx, salon.id, params.clientName, params.clientPhone);
        const presenceCfg = await tx.presenceConfirmationConfig.findUnique({
          where: { salonId: salon.id },
        });

        const created = await tx.appointment.create({
          data: {
            salonId: salon.id,
            professionalId: params.professionalId,
            serviceId: service.id,
            clientId: client.id,
            startAt: params.startAt,
            endAt,
            status: presenceCfg?.enabled ? "AWAITING_CONFIRMATION" : "CONFIRMED",
            paidSelfReported: params.wantsToPayNow,
            source: params.source,
          },
        });

        if (params.usePackageId) {
          const usable = await findUsablePackageForAppointment(
            { salonId: salon.id, clientId: client.id, serviceId: service.id, priceCents: service.priceCents },
            tx
          );
          if (!usable || usable.id !== params.usePackageId) throw new BookingError("PACKAGE_NOT_USABLE");

          const isServiceCredits = usable.packageDefinition.type === "SERVICE_CREDITS";
          await tx.clientPackage.update({
            where: { id: usable.id },
            data: isServiceCredits
              ? { remainingCredits: { decrement: 1 } }
              : { remainingValueCents: { decrement: service.priceCents } },
          });
          await tx.packageConsumption.create({
            data: {
              clientPackageId: usable.id,
              appointmentId: created.id,
              creditsUsed: isServiceCredits ? 1 : null,
              valueUsedCents: isServiceCredits ? null : service.priceCents,
            },
          });
          created.coveredByPackage = true;
          await tx.appointment.update({ where: { id: created.id }, data: { coveredByPackage: true } });
        }

        await tx.whatsAppMessageJob.create({
          data: { appointmentId: created.id, type: "BOOKING_CONFIRMATION", scheduledFor: new Date() },
        });
        await scheduleReminderJobs(tx, created, presenceCfg);
        await recordAppointmentEvent(
          { salonId: salon.id, appointmentId: created.id, type: "CREATED", actor: params.actor },
          tx
        );

        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    dispatchInBackground(() =>
      notifyStaffAboutAppointment({ appointmentId: appointment.id, kind: "CREATED", actor: params.actor })
    );
    return { salon, appointment };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
      throw new BookingError("SLOT_TAKEN");
    }
    throw err;
  }
}

/** Cancela pelo token (cliente) ou por id+salão (dono/sistema) — ver `cancelAppointmentById`. */
export async function cancelAppointmentByToken(params: {
  accessToken: string;
  actor: AppointmentEventActor;
}) {
  const appointment = await prisma.appointment.findUnique({
    where: { accessToken: params.accessToken },
  });
  if (!appointment) throw new BookingError("NOT_FOUND");
  return cancelAppointmentEntity(appointment, params.actor);
}

export async function cancelAppointmentById(params: {
  salonId: string;
  appointmentId: string;
  actor: AppointmentEventActor;
}) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: params.appointmentId, salonId: params.salonId },
  });
  if (!appointment) throw new BookingError("NOT_FOUND");
  return cancelAppointmentEntity(appointment, params.actor);
}

async function cancelAppointmentEntity(
  appointment: { id: string; salonId: string; status: string },
  actor: AppointmentEventActor
) {
  if (appointment.status === "CANCELLED") throw new BookingError("ALREADY_CANCELLED");
  if (appointment.status === "COMPLETED" || appointment.status === "NO_SHOW") {
    throw new BookingError("ALREADY_FINISHED");
  }

  await prisma.$transaction(async (tx) => {
    await tx.appointment.update({ where: { id: appointment.id }, data: { status: "CANCELLED" } });
    await cancelPendingWhatsAppJobs(appointment.id, tx);
    await recordAppointmentEvent(
      { salonId: appointment.salonId, appointmentId: appointment.id, type: "CANCELLED", actor },
      tx
    );
  });

  dispatchInBackground(() => notifyStaffAboutAppointment({ appointmentId: appointment.id, kind: "CANCELLED", actor }));
  return appointment;
}

/** Confirmação de presença via link — sempre pelo cliente. */
export async function confirmPresenceByToken(accessToken: string) {
  const appointment = await prisma.appointment.findUnique({ where: { accessToken } });
  if (!appointment) throw new BookingError("NOT_FOUND");
  if (appointment.status !== "AWAITING_CONFIRMATION" && appointment.status !== "CONFIRMED") {
    throw new BookingError("CANNOT_CONFIRM");
  }

  await prisma.$transaction(async (tx) => {
    await tx.appointment.update({ where: { id: appointment.id }, data: { status: "CONFIRMED" } });
    await recordAppointmentEvent(
      {
        salonId: appointment.salonId,
        appointmentId: appointment.id,
        type: "PRESENCE_CONFIRMED",
        actor: "CLIENT",
      },
      tx
    );
  });

  // Só avisa na transição de verdade (AWAITING → CONFIRMED), não a cada clique.
  if (appointment.status === "AWAITING_CONFIRMATION") {
    dispatchInBackground(() =>
      notifyStaffAboutAppointment({ appointmentId: appointment.id, kind: "PRESENCE_CONFIRMED", actor: "CLIENT" })
    );
  }
  return appointment;
}

/**
 * Reagenda mantendo o mesmo token. No fluxo público (`actor: "CLIENT"`) o
 * novo horário também precisa estar em `getAvailableSlots`; o dono (B3) pode
 * encaixar fora da grade, só checando conflito.
 */
export async function rescheduleAppointmentByToken(params: {
  accessToken: string;
  newStartAt: Date;
  actor: AppointmentEventActor;
}) {
  if (Number.isNaN(params.newStartAt.getTime())) throw new BookingError("PAST_SLOT");
  if (params.newStartAt.getTime() < Date.now()) throw new BookingError("PAST_SLOT");

  let previousStartAt: Date | null = null;
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const appointment = await tx.appointment.findUnique({
          where: { accessToken: params.accessToken },
          include: { service: true, salon: { include: { presenceConfirmationCfg: true } } },
        });
        if (!appointment) throw new BookingError("NOT_FOUND");
        if (
          appointment.status === "CANCELLED" ||
          appointment.status === "COMPLETED" ||
          appointment.status === "NO_SHOW"
        ) {
          throw new BookingError("CANNOT_RESCHEDULE");
        }

        const newEndAt = new Date(
          params.newStartAt.getTime() + appointment.service.durationMinutes * 60_000
        );

        if (params.actor === "CLIENT") {
          await assertSlotIsOffered(
            appointment.professionalId,
            appointment.serviceId,
            params.newStartAt,
            appointment.id
          );
        }
        await assertNoConflict(tx, appointment.professionalId, params.newStartAt, newEndAt, appointment.id);

        previousStartAt = appointment.startAt;
        const presenceEnabled = appointment.salon.presenceConfirmationCfg?.enabled ?? false;

        const updated = await tx.appointment.update({
          where: { id: appointment.id },
          data: {
            startAt: params.newStartAt,
            endAt: newEndAt,
            status: presenceEnabled ? "AWAITING_CONFIRMATION" : "CONFIRMED",
            noShowHandledAt: null,
            rescheduledCount: { increment: 1 },
          },
        });

        await cancelPendingWhatsAppJobs(appointment.id, tx);
        await scheduleReminderJobs(tx, updated, appointment.salon.presenceConfirmationCfg);
        await recordAppointmentEvent(
          {
            salonId: appointment.salonId,
            appointmentId: appointment.id,
            type: "RESCHEDULED",
            actor: params.actor,
            previousStartAt,
            newStartAt: params.newStartAt,
          },
          tx
        );

        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    const previous = previousStartAt;
    dispatchInBackground(() =>
      notifyStaffAboutAppointment({ appointmentId: result.id, kind: "RESCHEDULED", actor: params.actor, previousStartAt: previous })
    );
    return result;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
      throw new BookingError("SLOT_TAKEN");
    }
    throw err;
  }
}
