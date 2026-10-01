"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentSalon } from "@/lib/currentSalon";

/** Anotações do dono sobre o cliente (F8) — texto livre, nada estruturado. */
export async function updateClientNotesAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  if (!id) return;

  const salon = await getCurrentSalon();
  const client = await prisma.client.findFirst({ where: { id, salonId: salon.id } });
  if (!client) return;

  await prisma.client.update({ where: { id }, data: { notes: notes || null } });
  revalidatePath(`/clientes/${id}`);
}

/** Banir (F7): recusa silenciosamente novos agendamentos (ver src/lib/booking.ts). */
export async function banClientAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!id) return;

  const salon = await getCurrentSalon();
  const client = await prisma.client.findFirst({ where: { id, salonId: salon.id } });
  if (!client) return;

  await prisma.client.update({
    where: { id },
    data: { bannedAt: new Date(), banReason: reason || null },
  });
  revalidatePath(`/clientes/${id}`);
  revalidatePath("/clientes");
}

export async function unbanClientAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const salon = await getCurrentSalon();
  const client = await prisma.client.findFirst({ where: { id, salonId: salon.id } });
  if (!client) return;

  await prisma.client.update({ where: { id }, data: { bannedAt: null, banReason: null } });
  revalidatePath(`/clientes/${id}`);
  revalidatePath("/clientes");
}
