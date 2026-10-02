import type { Subscription } from "@prisma/client";

export type SubscriptionAccess = "OK" | "GRACE" | "BLOCKED";

const GRACE_DAYS = 5;

/**
 * F6: bloqueio por falta de pagamento, com carência de 5 dias (decisão
 * registrada em STATUS-DO-PROJETO.md). OK até o fim do período (trial ou
 * pago); depois disso entra em carência (ainda funciona, com banner); depois
 * da carência, BLOCKED — link público indisponível, API recusa agendamento.
 * Assinatura cancelada (status CANCELLED) é BLOCKED direto, sem carência.
 */
export function getSubscriptionAccess(
  subscription: Pick<Subscription, "status" | "trialEndsAt" | "currentPeriodEnd"> | null,
  now: Date = new Date()
): SubscriptionAccess {
  if (!subscription) return "BLOCKED";
  if (subscription.status === "CANCELLED") return "BLOCKED";

  const periodEnd =
    subscription.status === "TRIAL" ? subscription.trialEndsAt : subscription.currentPeriodEnd;
  if (!periodEnd) return "OK"; // ACTIVE sem currentPeriodEnd definido ainda — não bloqueia.

  if (now <= periodEnd) return "OK";

  const graceEnd = new Date(periodEnd.getTime() + GRACE_DAYS * 24 * 60 * 60_000);
  return now <= graceEnd ? "GRACE" : "BLOCKED";
}
