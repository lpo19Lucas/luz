"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentSalon } from "@/lib/currentSalon";

/** Dono oculta/reexibe uma avaliação da vitrine pública sem apagar (continua em /avaliacoes). */
export async function toggleReviewVisibilityAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const salon = await getCurrentSalon();
  const review = await prisma.review.findFirst({ where: { id, salonId: salon.id } });
  if (!review) return;

  await prisma.review.update({ where: { id }, data: { hiddenByOwner: !review.hiddenByOwner } });
  revalidatePath("/avaliacoes");
}
