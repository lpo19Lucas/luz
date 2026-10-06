"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfessional } from "@/lib/currentSalon";
import { setAppointmentOutcome, type AppointmentOutcome } from "@/lib/appointmentOutcome";

const OUTCOMES: AppointmentOutcome[] = ["COMPLETED", "NO_SHOW", "PENDING"];

/**
 * /minha-agenda: o profissional marca "Concluído"/"Não compareceu" só nos
 * PRÓPRIOS atendimentos (o escopo por professionalId está em
 * setAppointmentOutcome) — fica registrado no histórico como "Profissional".
 */
export async function setOwnAppointmentOutcomeAction(formData: FormData) {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const outcome = String(formData.get("outcome") ?? "") as AppointmentOutcome;
  if (!appointmentId || !OUTCOMES.includes(outcome)) return;

  const member = await getCurrentProfessional();
  await setAppointmentOutcome({
    salonId: member.salon.id,
    appointmentId,
    outcome,
    professionalId: member.professional.id,
    actor: "PROFESSIONAL",
  });
  revalidatePath("/minha-agenda");
}
