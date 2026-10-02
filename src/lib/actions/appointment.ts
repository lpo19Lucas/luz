"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSalon } from "@/lib/currentSalon";
import { setAppointmentOutcome, type AppointmentOutcome } from "@/lib/appointmentOutcome";
import { cancelAppointmentById, BookingError } from "@/lib/booking";

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

/** Botão "Cancelar" do card da Agenda — cancelamento pelo dono (B3). */
export async function cancelAppointmentOwnerAction(formData: FormData) {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  if (!appointmentId) return;

  const salon = await getCurrentSalon();
  try {
    await cancelAppointmentById({ salonId: salon.id, appointmentId, actor: "OWNER" });
  } catch (err) {
    // Idempotência silenciosa: se já estava cancelado/encerrado ou não existe
    // mais (clique duplo, aba antiga), não há nada útil a fazer aqui — a
    // revalidação abaixo já vai mostrar o estado atual na agenda.
    if (!(err instanceof BookingError)) throw err;
  }

  revalidatePath("/agenda");
}
