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

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function emptyToNull(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  return str === "" ? null : str;
}

function validColorOrNull(value: FormDataEntryValue | null) {
  const str = emptyToNull(value);
  return str && HEX_COLOR.test(str) ? str : null;
}

/**
 * F3: perfil público do salão — tudo opcional (capa, cores, redes sociais,
 * endereço, CNPJ, e-mail, WhatsApp). A capa já chega redimensionada do
 * navegador (src/lib/imageResize.ts) como data URL; aqui só valida que tem
 * cara de imagem antes de gravar, pra não guardar lixo em `coverImageData`.
 */
export async function updateSalonProfileAction(formData: FormData) {
  const salon = await getCurrentSalon();

  const coverImageData = emptyToNull(formData.get("coverImageData"));
  const removeCover = formData.get("removeCover") === "on";

  await prisma.salon.update({
    where: { id: salon.id },
    data: {
      description: emptyToNull(formData.get("description")),
      primaryColor: validColorOrNull(formData.get("primaryColor")),
      accentColor: validColorOrNull(formData.get("accentColor")),
      whatsappPhone: emptyToNull(formData.get("whatsappPhone"))?.replace(/\D/g, "") || null,
      email: emptyToNull(formData.get("email")),
      cnpj: emptyToNull(formData.get("cnpj")),
      instagramUrl: emptyToNull(formData.get("instagramUrl")),
      facebookUrl: emptyToNull(formData.get("facebookUrl")),
      tiktokUrl: emptyToNull(formData.get("tiktokUrl")),
      websiteUrl: emptyToNull(formData.get("websiteUrl")),
      addressStreet: emptyToNull(formData.get("addressStreet")),
      addressNumber: emptyToNull(formData.get("addressNumber")),
      addressComplement: emptyToNull(formData.get("addressComplement")),
      addressNeighborhood: emptyToNull(formData.get("addressNeighborhood")),
      addressCity: emptyToNull(formData.get("addressCity")),
      addressState: emptyToNull(formData.get("addressState")),
      addressZip: emptyToNull(formData.get("addressZip")),
      ...(removeCover
        ? { coverImageData: null, coverImageUpdatedAt: null }
        : coverImageData && coverImageData.startsWith("data:image/")
          ? { coverImageData, coverImageUpdatedAt: new Date() }
          : {}),
    },
  });

  revalidatePath("/configuracoes");
  revalidatePath(`/${salon.slug}`);
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
