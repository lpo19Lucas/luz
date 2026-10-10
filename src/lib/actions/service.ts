"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSalon } from "@/lib/currentSalon";
import { ASSET_SIZES } from "@/lib/clientAssets";
import { readImageField, setEntityImage, deleteStoredImage } from "@/lib/storedImages";

export async function createServiceAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const durationMinutes = Number(formData.get("durationMinutes"));
  const priceReais = Number(formData.get("price"));
  if (!name || !durationMinutes || Number.isNaN(priceReais)) return;

  const salon = await getCurrentSalon();
  const created = await prisma.service.create({
    data: {
      salonId: salon.id,
      name,
      durationMinutes,
      priceCents: Math.round(priceReais * 100),
      sizePricesJson: readSizePrices(formData),
    },
  });
  const image = readImageField(formData);
  if (image) await setEntityImage(salon.id, { kind: "service", id: created.id }, image);
  revalidatePath("/servicos");
}

export async function updateServiceAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const durationMinutes = Number(formData.get("durationMinutes"));
  const priceReais = Number(formData.get("price"));
  if (!id || !name || !durationMinutes || Number.isNaN(priceReais)) return;

  const salon = await getCurrentSalon();
  const service = await prisma.service.findFirst({ where: { id, salonId: salon.id } });
  if (!service) return;

  await prisma.service.update({
    where: { id },
    data: { name, durationMinutes, priceCents: Math.round(priceReais * 100), sizePricesJson: readSizePrices(formData) },
  });
  const image = readImageField(formData);
  if (image !== undefined) await setEntityImage(salon.id, { kind: "service", id }, image);
  revalidatePath("/servicos");
  revalidatePath(`/${salon.slug}`);
  redirect("/servicos");
}

/**
 * Mesma regra do profissional: FK RESTRICT em Appointment.serviceId impede
 * excluir um serviço já usado em algum agendamento. Nesse caso, não tem
 * "inativar" pro serviço (schema não tem esse campo) — só avisamos que não
 * deu, sem crashar a página.
 */
export async function deleteServiceAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const salon = await getCurrentSalon();
  const service = await prisma.service.findFirst({ where: { id, salonId: salon.id } });
  if (!service) return;

  try {
    await prisma.service.delete({ where: { id } });
    await deleteStoredImage(salon.id, service.imageId);
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003")) {
      throw err;
    }
    // Já tem agendamento usando esse serviço — não é possível excluir.
  }
  revalidatePath("/servicos");
}

/** Preços por porte do formulário; vazio/ inválido vira "sem preço próprio". Null se nenhum foi preenchido. */
function readSizePrices(formData: FormData): Prisma.InputJsonValue | typeof Prisma.DbNull {
  const out: Record<string, number> = {};
  for (const size of ASSET_SIZES) {
    const raw = String(formData.get(`price_${size}`) ?? "").trim();
    if (!raw) continue;
    const reais = Number(raw);
    if (Number.isFinite(reais) && reais >= 0) out[size] = Math.round(reais * 100);
  }
  return Object.keys(out).length > 0 ? out : Prisma.DbNull;
}
