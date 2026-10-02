"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSalon } from "@/lib/currentSalon";
import { WEEKDAYS } from "@/lib/weekdays";

function parseAvailabilityFromForm(formData: FormData) {
  const rows: { weekday: number; startTime: string; endTime: string }[] = [];
  for (const { value: weekday } of WEEKDAYS) {
    const startTime = String(formData.get(`avail_${weekday}_start`) ?? "").trim();
    const endTime = String(formData.get(`avail_${weekday}_end`) ?? "").trim();
    if (startTime && endTime) {
      rows.push({ weekday, startTime, endTime });
    }
  }
  return rows;
}

function parseServiceIdsFromForm(formData: FormData) {
  return formData.getAll("serviceIds").map(String).filter(Boolean);
}

/** % de comissão (0-100) — campo opcional, sem valor padrão de salão
 * (decisão do Lucas: cada profissional precisa da própria config). */
function parseCommissionPercent(formData: FormData) {
  const raw = String(formData.get("commissionPercent") ?? "").trim();
  if (raw === "") return null;
  const value = Number(raw);
  if (Number.isNaN(value) || value < 0 || value > 100) return null;
  return value;
}

/**
 * Cria profissional já com disponibilidade semanal e os serviços que ele
 * realiza — sem isso, `getAvailableSlots` (src/lib/slots.ts) nunca encontra
 * horário nenhum pra esse profissional (bug real: um salão novo cadastrando
 * profissionais/serviços direto pelo dashboard, sem passar pelo seed de
 * demonstração, nunca tinha Availability nem ServiceProfessional criados).
 */
export async function createProfessionalAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const salon = await getCurrentSalon();
  const availability = parseAvailabilityFromForm(formData);
  const serviceIds = parseServiceIdsFromForm(formData);

  await prisma.professional.create({
    data: {
      salonId: salon.id,
      name,
      commissionPercent: parseCommissionPercent(formData),
      availability: { create: availability },
      services: { create: serviceIds.map((serviceId) => ({ serviceId })) },
    },
  });
  revalidatePath("/profissionais");
}

export async function updateProfessionalAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const active = formData.get("active") === "on";
  if (!id || !name) return;

  const salon = await getCurrentSalon();
  const professional = await prisma.professional.findFirst({ where: { id, salonId: salon.id } });
  if (!professional) return;

  const availability = parseAvailabilityFromForm(formData);
  const serviceIds = parseServiceIdsFromForm(formData);

  await prisma.$transaction([
    prisma.professional.update({
      where: { id },
      data: { name, active, commissionPercent: parseCommissionPercent(formData) },
    }),
    // Substitui a disponibilidade e os vínculos de serviço por completo —
    // mais simples do que calcular diff, e o volume por profissional é
    // pequeno (no máximo 7 linhas de disponibilidade).
    prisma.availability.deleteMany({ where: { professionalId: id } }),
    prisma.availability.createMany({
      data: availability.map((a) => ({ ...a, professionalId: id })),
    }),
    prisma.serviceProfessional.deleteMany({ where: { professionalId: id } }),
    prisma.serviceProfessional.createMany({
      data: serviceIds.map((serviceId) => ({ serviceId, professionalId: id })),
    }),
  ]);

  revalidatePath("/profissionais");
  redirect("/profissionais");
}

/**
 * Exclusão de verdade só é possível sem agendamentos vinculados (FK
 * RESTRICT em Appointment.professionalId — decisão consciente, histórico de
 * agendamento não pode ficar órfão). Com agendamentos, cai pra inativar em
 * vez de excluir — mantém o botão útil sem crash.
 */
export async function deleteProfessionalAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const salon = await getCurrentSalon();
  const professional = await prisma.professional.findFirst({ where: { id, salonId: salon.id } });
  if (!professional) return;

  try {
    await prisma.professional.delete({ where: { id } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      await prisma.professional.update({ where: { id }, data: { active: false } });
    } else {
      throw err;
    }
  }
  revalidatePath("/profissionais");
}
