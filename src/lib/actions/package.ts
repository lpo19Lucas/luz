"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentSalon } from "@/lib/currentSalon";
import { PackageType } from "@prisma/client";
import { redirect } from "next/navigation";
import {
  purchasePackageManually,
  confirmPackagePayment,
  cancelClientPackage,
  reservePackagePublic,
  PackageError,
} from "@/lib/packages";

/** CRUD de PackageDefinition (o "cardápio" de pacotes à venda do salão). */
export async function createPackageDefinitionAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "") as PackageType;
  const priceReais = Number(formData.get("price"));
  const validityDays = Number(formData.get("validityDays"));
  if (!name || !priceReais || !validityDays) return;
  if (type !== "SERVICE_CREDITS" && type !== "CASH_CREDIT") return;

  const salon = await getCurrentSalon();

  if (type === "SERVICE_CREDITS") {
    const serviceId = String(formData.get("serviceId") ?? "");
    const credits = Number(formData.get("credits"));
    if (!serviceId || !credits) return;
    const service = await prisma.service.findFirst({ where: { id: serviceId, salonId: salon.id } });
    if (!service) return;

    await prisma.packageDefinition.create({
      data: {
        salonId: salon.id,
        name,
        type,
        serviceId,
        credits,
        priceCents: Math.round(priceReais * 100),
        validityDays,
      },
    });
  } else {
    const valueReais = Number(formData.get("value"));
    if (!valueReais) return;

    await prisma.packageDefinition.create({
      data: {
        salonId: salon.id,
        name,
        type,
        valueCents: Math.round(valueReais * 100),
        priceCents: Math.round(priceReais * 100),
        validityDays,
      },
    });
  }

  revalidatePath("/pacotes");
}

export async function togglePackageDefinitionActiveAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const salon = await getCurrentSalon();
  const def = await prisma.packageDefinition.findFirst({ where: { id, salonId: salon.id } });
  if (!def) return;

  await prisma.packageDefinition.update({ where: { id }, data: { active: !def.active } });
  revalidatePath("/pacotes");
}

/** Dono registra a venda de um pacote pra um cliente (sem gateway — já paga na hora). */
export async function sellPackageToClientAction(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  const packageDefinitionId = String(formData.get("packageDefinitionId") ?? "");
  if (!clientId || !packageDefinitionId) return;

  const salon = await getCurrentSalon();
  try {
    await purchasePackageManually({ salonId: salon.id, clientId, packageDefinitionId });
  } catch (err) {
    if (!(err instanceof PackageError)) throw err;
    // Falha silenciosa (definição inativa/cliente banido) — mesmo padrão das outras actions do projeto.
  }
  revalidatePath(`/clientes/${clientId}`);
}

export async function confirmPackagePaymentAction(formData: FormData) {
  const clientPackageId = String(formData.get("clientPackageId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientPackageId) return;

  const salon = await getCurrentSalon();
  try {
    await confirmPackagePayment({ salonId: salon.id, clientPackageId });
  } catch (err) {
    if (!(err instanceof PackageError)) throw err;
  }
  if (clientId) revalidatePath(`/clientes/${clientId}`);
}

/** Fluxo público: cliente reserva um pacote pelo link do salão — sem gateway,
 * fica aguardando o dono confirmar o pagamento (ver /clientes/[id]). */
export async function reservePackagePublicAction(formData: FormData) {
  const salonSlug = String(formData.get("salonSlug") ?? "");
  const packageDefinitionId = String(formData.get("packageDefinitionId") ?? "");
  const clientName = String(formData.get("clientName") ?? "").trim();
  const clientPhone = String(formData.get("clientPhone") ?? "").trim();
  if (!salonSlug || !packageDefinitionId || !clientName || !clientPhone) return;

  try {
    await reservePackagePublic({ salonSlug, packageDefinitionId, clientName, clientPhone });
  } catch (err) {
    if (!(err instanceof PackageError)) throw err;
    redirect(`/${salonSlug}?pacoteErro=1`);
  }
  redirect(`/${salonSlug}?pacoteReservado=1`);
}

export async function cancelClientPackageAction(formData: FormData) {
  const clientPackageId = String(formData.get("clientPackageId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientPackageId) return;

  const salon = await getCurrentSalon();
  try {
    await cancelClientPackage({ salonId: salon.id, clientPackageId });
  } catch (err) {
    if (!(err instanceof PackageError)) throw err;
  }
  if (clientId) revalidatePath(`/clientes/${clientId}`);
}
