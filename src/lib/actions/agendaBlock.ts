"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentSalon } from "@/lib/currentSalon";
import { AgendaBlockRecurrence } from "@prisma/client";

/**
 * "YYYY-MM-DD" do form -> Date em UTC meia-noite. `date`/`startsOn`/`endsOn`
 * são colunas `@db.Date` (sem hora nem fuso) — o Postgres guarda só o
 * calendário, então não tem "horário do salão" aqui pra normalizar; exibir
 * de volta precisa usar timeZone: "UTC" (ver describeBlock), nunca
 * formatSalonDate (que é pra instantes de verdade, e deslocaria um dia).
 */
function parseFormDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

const RECURRENCES: AgendaBlockRecurrence[] = ["ONCE", "DAILY", "WEEKLY"];

function emptyToNull(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  return str === "" ? null : str;
}

/** CRUD único (F4): bloqueio pontual ou recorrente, de um profissional ou do
 * salão inteiro (professionalId vazio = feriado/fechamento geral). */
export async function createAgendaBlockAction(formData: FormData) {
  const recurrence = String(formData.get("recurrence") ?? "") as AgendaBlockRecurrence;
  if (!RECURRENCES.includes(recurrence)) return;

  const professionalId = emptyToNull(formData.get("professionalId"));
  const dateStr = emptyToNull(formData.get("date"));
  const weekdayStr = emptyToNull(formData.get("weekday"));
  const startsOnStr = emptyToNull(formData.get("startsOn"));
  const endsOnStr = emptyToNull(formData.get("endsOn"));
  const startTime = emptyToNull(formData.get("startTime"));
  const endTime = emptyToNull(formData.get("endTime"));
  const reason = emptyToNull(formData.get("reason"));

  if (recurrence === "ONCE" && !dateStr) return;
  if (recurrence === "WEEKLY" && weekdayStr === null) return;
  // Faixa de horário precisa dos dois lados, ou nenhum (dia inteiro).
  if ((startTime === null) !== (endTime === null)) return;

  const salon = await getCurrentSalon();

  if (professionalId) {
    const professional = await prisma.professional.findFirst({
      where: { id: professionalId, salonId: salon.id },
    });
    if (!professional) return;
  }

  await prisma.agendaBlock.create({
    data: {
      salonId: salon.id,
      professionalId,
      recurrence,
      date: recurrence === "ONCE" && dateStr ? parseFormDate(dateStr) : null,
      weekday: recurrence === "WEEKLY" && weekdayStr !== null ? Number(weekdayStr) : null,
      startsOn: recurrence !== "ONCE" && startsOnStr ? parseFormDate(startsOnStr) : null,
      endsOn: recurrence !== "ONCE" && endsOnStr ? parseFormDate(endsOnStr) : null,
      startTime,
      endTime,
      reason,
    },
  });

  revalidatePath("/bloqueios");
}

export async function deleteAgendaBlockAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const salon = await getCurrentSalon();
  const block = await prisma.agendaBlock.findFirst({ where: { id, salonId: salon.id } });
  if (!block) return;

  await prisma.agendaBlock.delete({ where: { id } });
  revalidatePath("/bloqueios");
}
