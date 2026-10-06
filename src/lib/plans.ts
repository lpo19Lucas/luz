import type { PlatformPlan, SubscriptionPlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Planos da plataforma (B9/F6). Antes era uma tabela fixa aqui; agora vem da
 * tabela `platform_plans`, editável em /admin/planos. A lista abaixo é só o
 * fallback (mesmos valores da migration) pra quando o banco não responder —
 * ex.: a landing sendo pré-renderizada sem banco disponível.
 */
export const DEFAULT_PLATFORM_PLANS: Omit<PlatformPlan, "updatedAt">[] = [
  { plan: "TRIAL", label: "Teste grátis", priceCents: 0, durationDays: 50, description: null, active: true, sortOrder: 0 },
  { plan: "MONTHLY", label: "Mensal", priceCents: 7900, durationDays: 30, description: "cobrado todo mês", active: true, sortOrder: 1 },
  { plan: "QUARTERLY", label: "Trimestral", priceCents: 20700, durationDays: 90, description: null, active: true, sortOrder: 2 },
  { plan: "YEARLY", label: "Anual", priceCents: 70800, durationDays: 365, description: null, active: true, sortOrder: 3 },
];

export type PlanInfo = Omit<PlatformPlan, "updatedAt"> & {
  /** Preço equivalente por mês, em centavos (arredondado). */
  pricePerMonthCents: number;
  /** Texto curto embaixo do preço — `description` ou um gerado. */
  sub: string;
};

export const PLAN_LABEL: Record<string, string> = {
  TRIAL: "Trial",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  YEARLY: "Anual",
};

export function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: cents % 100 === 0 ? 0 : 2 });
}

/** Preço por mês equivalente — base de 30 dias por mês. */
export function pricePerMonthCents(plan: Pick<PlatformPlan, "priceCents" | "durationDays">) {
  const months = Math.max(1, Math.round(plan.durationDays / 30));
  return Math.round(plan.priceCents / months);
}

export function describePlan(plan: Pick<PlatformPlan, "plan" | "priceCents" | "durationDays" | "description">) {
  if (plan.description?.trim()) return plan.description.trim();
  if (plan.plan === "TRIAL") return `${plan.durationDays} dias grátis`;
  const months = Math.round(plan.durationDays / 30);
  if (months <= 1) return "cobrado todo mês";
  if (months === 12) return `${formatBRL(plan.priceCents)} uma vez ao ano`;
  return `${formatBRL(plan.priceCents)} a cada ${months} meses`;
}

function toInfo(row: Omit<PlatformPlan, "updatedAt">): PlanInfo {
  return { ...row, pricePerMonthCents: pricePerMonthCents(row), sub: describePlan(row) };
}

/** Todos os planos (inclusive TRIAL e inativos), na ordem de exibição. */
export async function getPlatformPlans(): Promise<PlanInfo[]> {
  let rows: Omit<PlatformPlan, "updatedAt">[];
  try {
    rows = await prisma.platformPlan.findMany({ orderBy: { sortOrder: "asc" } });
  } catch {
    rows = [];
  }
  // Completa com o fallback qualquer plano que não tenha linha no banco.
  const byPlan = new Map(rows.map((r) => [r.plan, r]));
  for (const def of DEFAULT_PLATFORM_PLANS) {
    if (!byPlan.has(def.plan)) byPlan.set(def.plan, def);
  }
  return [...byPlan.values()].sort((a, b) => a.sortOrder - b.sortOrder).map(toInfo);
}

/** Planos pagos à venda (aparecem na landing e em /assinatura). */
export async function getPaidPlans(): Promise<PlanInfo[]> {
  return (await getPlatformPlans()).filter((p) => p.plan !== "TRIAL" && p.active);
}

export async function getPlan(plan: SubscriptionPlan): Promise<PlanInfo> {
  // getPlatformPlans já completa com o fallback, então sempre encontra.
  return (await getPlatformPlans()).find((p) => p.plan === plan)!;
}

export async function planDurationDays(plan: SubscriptionPlan): Promise<number> {
  return (await getPlan(plan)).durationDays;
}

/** Dias do teste grátis para novos cadastros (linha TRIAL). */
export async function getTrialDays(): Promise<number> {
  return planDurationDays("TRIAL");
}

/**
 * Chave PIX da plataforma (B9) — antes era um placeholder fixo no código
 * (`financeiro@plataforma-agendamento.com`); agora vem da env var, porque o
 * dono pagaria pra uma chave que não existe se continuasse hardcoded.
 */
export function getPlatformPixKey(): string | null {
  return process.env.PLATFORM_PIX_KEY?.trim() || null;
}
