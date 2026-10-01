import { prisma } from "@/lib/prisma";
import { salonMidnightUTC, salonWeekday } from "@/lib/timezone";

export interface AgendaKpis {
  scheduledCount: number; // agendados, não cancelados
  completedCount: number;
  noShowCount: number;
  expectedRevenueCents: number; // soma dos não cancelados (previsto)
  realizedRevenueCents: number; // soma dos COMPLETED (realizado)
  occupiedMinutes: number;
  availableMinutes: number;
}

function minutesBetween(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

function addDays(d: Date, days: number) {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

/**
 * KPIs de um período (dia ou semana) pra o cabeçalho da Agenda (F2):
 * agendados, concluídos, faltas, faturamento previsto e realizado, e a
 * ocupação (minutos ocupados / minutos disponíveis, pela disponibilidade
 * semanal recorrente — não desconta bloqueios pontuais, só uma aproximação
 * já suficiente pro painel).
 */
export async function getAgendaKpis(
  salonId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<AgendaKpis> {
  const appointments = await prisma.appointment.findMany({
    where: { salonId, startAt: { gte: rangeStart, lte: rangeEnd } },
    include: { service: true },
  });

  const nonCancelled = appointments.filter((a) => a.status !== "CANCELLED");
  const completed = appointments.filter((a) => a.status === "COMPLETED");
  const noShow = appointments.filter((a) => a.status === "NO_SHOW");

  const expectedRevenueCents = nonCancelled.reduce((sum, a) => sum + a.service.priceCents, 0);
  const realizedRevenueCents = completed.reduce((sum, a) => sum + a.service.priceCents, 0);
  const occupiedMinutes = nonCancelled.reduce((sum, a) => sum + a.service.durationMinutes, 0);

  const availabilities = await prisma.availability.findMany({
    where: { professional: { salonId, active: true } },
  });

  let availableMinutes = 0;
  for (
    let cursor = salonMidnightUTC(rangeStart);
    cursor.getTime() <= rangeEnd.getTime();
    cursor = addDays(cursor, 1)
  ) {
    const weekday = salonWeekday(cursor);
    for (const avail of availabilities) {
      if (avail.weekday !== weekday) continue;
      availableMinutes += minutesBetween(avail.startTime, avail.endTime);
    }
  }

  return {
    scheduledCount: nonCancelled.length,
    completedCount: completed.length,
    noShowCount: noShow.length,
    expectedRevenueCents,
    realizedRevenueCents,
    occupiedMinutes,
    availableMinutes,
  };
}
