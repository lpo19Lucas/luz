/**
 * Planos pagos (B9/F6) — movido pra um lugar só porque `/assinatura` (tela
 * do dono), `/admin` (conciliação manual) e a ativação em admin.ts
 * precisavam da mesma tabela de preço/duração.
 */
export const PLANS = [
  { value: "MONTHLY", label: "Mensal", pricePerMonth: 79, sub: "cobrado todo mês", durationDays: 30 },
  { value: "QUARTERLY", label: "Trimestral", pricePerMonth: 69, sub: "R$ 207 a cada 3 meses", durationDays: 90 },
  { value: "YEARLY", label: "Anual", pricePerMonth: 59, sub: "R$ 708 uma vez ao ano", durationDays: 365 },
] as const;

export type PlanValue = (typeof PLANS)[number]["value"];

export const PLAN_LABEL: Record<string, string> = {
  TRIAL: "Trial",
  ...Object.fromEntries(PLANS.map((p) => [p.value, p.label])),
};

export function planDurationDays(plan: string): number {
  return PLANS.find((p) => p.value === plan)?.durationDays ?? 30;
}

/**
 * Chave PIX da plataforma (B9) — antes era um placeholder fixo no código
 * (`financeiro@plataforma-agendamento.com`); agora vem da env var, porque o
 * dono pagaria pra uma chave que não existe se continuasse hardcoded.
 */
export function getPlatformPixKey(): string | null {
  return process.env.PLATFORM_PIX_KEY?.trim() || null;
}
