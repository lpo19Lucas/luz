"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentSalon } from "@/lib/currentSalon";

export async function updateSalonSettings(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const pixKey = String(formData.get("pixKey") ?? "").trim();
  if (!name) return;

  const salon = await getCurrentSalon();
  await prisma.salon.update({
    where: { id: salon.id },
    data: { name, pixKey: pixKey || null },
  });
  revalidatePath("/configuracoes");
  revalidatePath("/agenda"); // AppBar mostra o nome do salão em todo o dashboard
}

export async function updatePresenceConfirmationConfig(formData: FormData) {
  const enabled = formData.get("enabled") === "on";
  const hoursBefore = Number(formData.get("hoursBefore"));
  const actionOnNoConfirm = String(formData.get("actionOnNoConfirm") ?? "ALERT_ONLY");

  const salon = await getCurrentSalon();
  await prisma.presenceConfirmationConfig.upsert({
    where: { salonId: salon.id },
    update: {
      enabled,
      hoursBefore: Number.isFinite(hoursBefore) && hoursBefore > 0 ? hoursBefore : 24,
      actionOnNoConfirm: actionOnNoConfirm === "RELEASE_SLOT" ? "RELEASE_SLOT" : "ALERT_ONLY",
    },
    create: {
      salonId: salon.id,
      enabled,
      hoursBefore: Number.isFinite(hoursBefore) && hoursBefore > 0 ? hoursBefore : 24,
      actionOnNoConfirm: actionOnNoConfirm === "RELEASE_SLOT" ? "RELEASE_SLOT" : "ALERT_ONLY",
    },
  });
  revalidatePath("/configuracoes");
}

export async function chooseSubscriptionPlan(formData: FormData) {
  const plan = String(formData.get("plan") ?? "");
  if (!["MONTHLY", "QUARTERLY", "YEARLY"].includes(plan)) return;

  const salon = await getCurrentSalon();
  await prisma.subscription.update({
    where: { salonId: salon.id },
    // Só registra a intenção — a ativação de verdade continua manual (spec
    // seção 9/10): quem concilia o PIX confere e muda o status pra ACTIVE.
    data: { plan: plan as "MONTHLY" | "QUARTERLY" | "YEARLY" },
  });
  revalidatePath("/assinatura");
}
