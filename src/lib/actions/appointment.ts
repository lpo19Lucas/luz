"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSalon } from "@/lib/currentSalon";
import { setAppointmentOutcome, type AppointmentOutcome } from "@/lib/appointmentOutcome";

const OUTCOMES: AppointmentOutcome[] = ["COMPLETED", "NO_SHOW", "PENDING"];

/** Botões "Concluído" / "Não compareceu" / "Desfazer" do card da Agenda. */
export async function setAppointmentOutcomeAction(formData: FormData) {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const outcome = String(formData.get("outcome") ?? "") as AppointmentOutcome;
  if (!appointmentId || !OUTCOMES.includes(outcome)) return;

  const salon = await getCurrentSalon();
  await setAppointmentOutcome({ salonId: salon.id, appointmentId, outcome });

  revalidatePath("/agenda");
  revalidatePath("/metricas");
}
