"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAdminSession, destroyAdminSession } from "@/lib/auth";

export type FormState = { error: string } | undefined;

export async function adminLoginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return { error: "ADMIN_PASSWORD não configurada no servidor (ver .env.example)." };
  }
  if (password !== expected) {
    return { error: "Senha incorreta." };
  }

  await createAdminSession();
  redirect("/admin");
}

export async function adminLogoutAction() {
  await destroyAdminSession();
  redirect("/admin/login");
}

/**
 * Conciliação manual da assinatura (spec seção 9/10, pendência 4): quem
 * administra a plataforma confere o PIX recebido fora do sistema e então
 * ativa a assinatura aqui — não é um webhook, é uma ação humana registrada
 * (`activatedAt` / `activatedManuallyByEmail`).
 */
export async function setSubscriptionStatusAction(formData: FormData) {
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!subscriptionId || !["ACTIVE", "PAST_DUE", "CANCELLED", "TRIAL"].includes(status)) {
    return;
  }

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: status as "ACTIVE" | "PAST_DUE" | "CANCELLED" | "TRIAL",
      ...(status === "ACTIVE"
        ? {
            activatedAt: new Date(),
            activatedManuallyByEmail: "admin (painel /admin)",
            currentPeriodEnd: nextPeriodEnd(),
          }
        : {}),
    },
  });
  revalidatePath("/admin");
}

function nextPeriodEnd() {
  // Aproximação simples pro MVP: 30 dias a partir de agora, independente do
  // plano escolhido (mensal/trimestral/anual) — ajustar quando a conciliação
  // precisar diferenciar por plano de verdade.
  return new Date(Date.now() + 30 * 24 * 60 * 60_000);
}
