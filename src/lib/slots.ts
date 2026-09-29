import { prisma } from "@/lib/prisma";

const STEP_MINUTES = 20;

function parseHHMM(value: string, base: Date) {
  const [h, m] = value.split(":").map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Horários livres de um profissional pra um serviço num dia — cruza
 * disponibilidade recorrente semanal, bloqueios pontuais e agendamentos já
 * existentes (ver arquitetura-modelo-de-dados.md, seção 4). Grade fixa de
 * 20 em 20 minutos: simples e suficiente pro volume esperado do MVP.
 */
export async function getAvailableSlots(professionalId: string, serviceId: string, date: Date) {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return [];

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const [availabilities, exceptions, existingAppointments] = await Promise.all([
    prisma.availability.findMany({ where: { professionalId, weekday: dayStart.getDay() } }),
    prisma.availabilityException.findMany({ where: { professionalId, date: dayStart } }),
    prisma.appointment.findMany({
      where: { professionalId, status: { not: "CANCELLED" }, startAt: { gte: dayStart, lte: dayEnd } },
    }),
  ]);

  if (exceptions.some((e) => !e.startTime && !e.endTime)) return []; // dia inteiro bloqueado

  const durationMs = service.durationMinutes * 60_000;
  const now = new Date();
  const slots: Date[] = [];

  for (const avail of availabilities) {
    const windowStart = parseHHMM(avail.startTime, dayStart);
    const windowEnd = parseHHMM(avail.endTime, dayStart);

    for (
      let cursor = new Date(windowStart);
      cursor.getTime() + durationMs <= windowEnd.getTime();
      cursor = new Date(cursor.getTime() + STEP_MINUTES * 60_000)
    ) {
      const slotEnd = new Date(cursor.getTime() + durationMs);
      if (cursor < now) continue;

      const blockedByException = exceptions.some((e) => {
        if (!e.startTime || !e.endTime) return false;
        const exStart = parseHHMM(e.startTime, dayStart);
        const exEnd = parseHHMM(e.endTime, dayStart);
        return cursor < exEnd && slotEnd > exStart;
      });
      if (blockedByException) continue;

      const blockedByAppointment = existingAppointments.some(
        (a) => cursor < a.endAt && slotEnd > a.startAt
      );
      if (blockedByAppointment) continue;

      slots.push(new Date(cursor));
    }
  }

  return slots.sort((a, b) => a.getTime() - b.getTime());
}
