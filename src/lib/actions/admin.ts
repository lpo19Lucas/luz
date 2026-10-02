"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAdminSession, destroyAdminSession } from "@/lib/auth";
import { planDurationDays } from "@/lib/plans";

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

  const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription) return;

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: status as "ACTIVE" | "PAST_DUE" | "CANCELLED" | "TRIAL",
      ...(status === "ACTIVE"
        ? {
            activatedAt: new Date(),
            activatedManuallyByEmail: "admin (painel /admin)",
            currentPeriodEnd: nextPeriodEnd(subscription),
          }
        : {}),
    },
  });
  revalidatePath("/admin");
}

/**
 * F6: soma a duração do plano (30/90/365 dias) a partir de
 * max(agora, currentPeriodEnd) — assim renovar antes do vencimento empilha
 * o período em vez de perder os dias restantes, e renovar depois de vencido
 * conta a partir de hoje (não do passado).
 */
function nextPeriodEnd(subscription: { plan: string; currentPeriodEnd: Date | null }) {
  const base = subscription.currentPeriodEnd && subscription.currentPeriodEnd > new Date()
    ? subscription.currentPeriodEnd
    : new Date();
  const days = planDurationDays(subscription.plan);
  return new Date(base.getTime() + days * 24 * 60 * 60_000);
}
