import { AgendaBlock } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { salonMidnightUTC, salonWeekday, salonWallClockToUTC } from "@/lib/timezone";

function sameUTCDate(a: Date, b: Date) {
  return salonMidnightUTC(a).getTime() === salonMidnightUTC(b).getTime();
}

function withinRange(date: Date, startsOn: Date | null, endsOn: Date | null) {
  const day = salonMidnightUTC(date).getTime();
  if (startsOn && day < salonMidnightUTC(startsOn).getTime()) return false;
  if (endsOn && day > salonMidnightUTC(endsOn).getTime()) return false;
  return true;
}

/** Se um AgendaBlock (F4) vale pro dia `date` — ONCE compara a data exata,
 * DAILY e WEEKLY checam a recorrência dentro de startsOn/endsOn (opcionais). */
export function blockAppliesToDate(block: AgendaBlock, date: Date): boolean {
  if (block.recurrence === "ONCE") {
    return block.date !== null && sameUTCDate(block.date, date);
  }
  if (block.recurrence === "DAILY") {
    return withinRange(date, block.startsOn, block.endsOn);
  }
  // WEEKLY
  return block.weekday === salonWeekday(date) && withinRange(date, block.startsOn, block.endsOn);
}

/** Blocos (do profissional ou do salão inteiro) que valem pro dia `date`. */
export async function getBlocksForDate(salonId: string, professionalId: string, date: Date) {
  const blocks = await prisma.agendaBlock.findMany({
    where: { salonId, OR: [{ professionalId }, { professionalId: null }] },
  });
  return blocks.filter((b) => blockAppliesToDate(b, date));
}

/** Se um bloco cobre o dia inteiro (sem startTime/endTime) ou só uma faixa. */
export function blockIsFullDay(block: AgendaBlock) {
  return !block.startTime && !block.endTime;
}

/** Se o intervalo [start, end) cruza a faixa de horário de um bloco parcial. */
export function blockOverlaps(block: AgendaBlock, date: Date, start: Date, end: Date) {
  if (blockIsFullDay(block)) return true;
  const blockStart = salonWallClockToUTC(date, block.startTime!);
  const blockEnd = salonWallClockToUTC(date, block.endTime!);
  return start < blockEnd && end > blockStart;
}
