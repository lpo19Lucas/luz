import { prisma } from "@/lib/prisma";
import { salonMidnightUTC, salonEndOfDayUTC, salonWeekday, salonWallClockToUTC } from "@/lib/timezone";
import { getBlocksForDate, blockIsFullDay, blockOverlaps } from "@/lib/agendaBlocks";

const STEP_MINUTES = 20;

/**
 * Horários livres de um profissional pra um serviço num dia — cruza
 * disponibilidade recorrente semanal, bloqueios pontuais e agendamentos já
 * existentes (ver arquitetura-modelo-de-dados.md, seção 4). Grade fixa de
 * 20 em 20 minutos: simples e suficiente pro volume esperado do MVP.
 */
export async function getAvailableSlots(
  professionalId: string,
  serviceId: string,
  date: Date,
  excludeAppointmentId?: string
) {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return [];

  const dayStart = salonMidnightUTC(date);
  const dayEnd = salonEndOfDayUTC(date);

  const [availabilities, blocks, existingAppointments] = await Promise.all([
    prisma.availability.findMany({ where: { professionalId, weekday: salonWeekday(date) } }),
    getBlocksForDate(service.salonId, professionalId, date),
    prisma.appointment.findMany({
      where: {
        professionalId,
        status: { not: "CANCELLED" },
        startAt: { gte: dayStart, lte: dayEnd },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      },
    }),
  ]);

  if (blocks.some(blockIsFullDay)) return []; // dia inteiro bloqueado (profissional ou salão inteiro)

  const durationMs = service.durationMinutes * 60_000;
  const now = new Date();
  const slots: Date[] = [];

  for (const avail of availabilities) {
    const windowStart = salonWallClockToUTC(date, avail.startTime);
    const windowEnd = salonWallClockToUTC(date, avail.endTime);

    for (
      let cursor = new Date(windowStart);
      cursor.getTime() + durationMs <= windowEnd.getTime();
      cursor = new Date(cursor.getTime() + STEP_MINUTES * 60_000)
    ) {
      const slotEnd = new Date(cursor.getTime() + durationMs);
      if (cursor < now) continue;

      const blockedByAgendaBlock = blocks.some((b) => blockOverlaps(b, date, cursor, slotEnd));
      if (blockedByAgendaBlock) continue;

      const blockedByAppointment = existingAppointments.some(
        (a) => cursor < a.endAt && slotEnd > a.startAt
      );
      if (blockedByAppointment) continue;

      slots.push(new Date(cursor));
    }
  }

  return slots.sort((a, b) => a.getTime() - b.getTime());
}
