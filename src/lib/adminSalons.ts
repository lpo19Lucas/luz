import type { Prisma, SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSubscriptionAccess, type SubscriptionAccess } from "@/lib/subscriptionAccess";
import { getPlatformPlans, planDurationDays, pricePerMonthCents } from "@/lib/plans";

/**
 * Regras do painel de administração da plataforma (/admin): visão geral,
 * lista/detalhe de salões e ações sobre assinatura, publicação, acesso do dono
 * e planos. As server actions de src/lib/actions/admin.ts só checam a sessão
 * de admin e chamam estas funções.
 */

export class AdminError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID_INPUT" | "EMAIL_TAKEN", message: string) {
    super(message);
  }
}

const DAY_MS = 24 * 60 * 60_000;
const SUBSCRIPTION_PLANS: SubscriptionPlan[] = ["TRIAL", "MONTHLY", "QUARTERLY", "YEARLY"];
const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ["TRIAL", "ACTIVE", "PAST_DUE", "CANCELLED"];

export function isSubscriptionPlan(value: string): value is SubscriptionPlan {
  return (SUBSCRIPTION_PLANS as string[]).includes(value);
}
export function isSubscriptionStatus(value: string): value is SubscriptionStatus {
  return (SUBSCRIPTION_STATUSES as string[]).includes(value);
}

/** Fim do período vigente (teste ou pago) — o que vence primeiro pro admin. */
export function periodEnd(sub: { status: SubscriptionStatus; trialEndsAt: Date; currentPeriodEnd: Date | null }) {
  return sub.status === "TRIAL" ? sub.trialEndsAt : sub.currentPeriodEnd;
}

// ------------------------------------------------------------
// Visão geral
// ------------------------------------------------------------

export async function getPlatformOverview(now: Date = new Date()) {
  const [salons, plans, appointmentsLast30] = await Promise.all([
    prisma.salon.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        publishedAt: true,
        owner: { select: { email: true, disabledAt: true } },
        subscription: true,
      },
    }),
    getPlatformPlans(),
    prisma.appointment.count({ where: { createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } } }),
  ]);

  const access: Record<SubscriptionAccess, number> = { OK: 0, GRACE: 0, BLOCKED: 0 };
  let mrrCents = 0;
  let paying = 0;
  let trials = 0;
  const attention: Array<{ id: string; name: string; email: string; reason: string; date: Date | null }> = [];

  for (const salon of salons) {
    const sub = salon.subscription;
    const acc = getSubscriptionAccess(sub, now);
    access[acc]++;
    if (!sub) {
      attention.push({ id: salon.id, name: salon.name, email: salon.owner.email, reason: "Sem assinatura", date: null });
      continue;
    }
    const end = periodEnd(sub);
    if (sub.status === "TRIAL") trials++;
    if (sub.status === "ACTIVE" && acc !== "BLOCKED") {
      paying++;
      const plan = plans.find((p) => p.plan === sub.plan);
      if (plan) mrrCents += pricePerMonthCents(plan);
    }

    if (acc === "BLOCKED" && sub.status !== "CANCELLED") {
      attention.push({ id: salon.id, name: salon.name, email: salon.owner.email, reason: "Bloqueado por falta de pagamento", date: end });
    } else if (acc === "GRACE") {
      attention.push({ id: salon.id, name: salon.name, email: salon.owner.email, reason: "Em carência", date: end });
    } else if (sub.status === "PAST_DUE") {
      attention.push({ id: salon.id, name: salon.name, email: salon.owner.email, reason: "Pagamento pendente", date: end });
    } else if (end && end > now && end.getTime() - now.getTime() <= 7 * DAY_MS) {
      attention.push({
        id: salon.id,
        name: salon.name,
        email: salon.owner.email,
        reason: sub.status === "TRIAL" ? "Teste acaba em até 7 dias" : "Plano vence em até 7 dias",
        date: end,
      });
    }
  }

  attention.sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));

  return {
    totalSalons: salons.length,
    published: salons.filter((s) => s.publishedAt).length,
    newLast30: salons.filter((s) => s.createdAt >= new Date(now.getTime() - 30 * DAY_MS)).length,
    disabledOwners: salons.filter((s) => s.owner.disabledAt).length,
    access,
    trials,
    paying,
    mrrCents,
    appointmentsLast30,
    attention,
  };
}

// ------------------------------------------------------------
// Lista e detalhe de salões
// ------------------------------------------------------------

export type SalonFilter = "all" | "trial" | "active" | "grace" | "blocked" | "unpublished" | "disabled";
export const SALON_FILTERS: Record<SalonFilter, string> = {
  all: "Todos",
  trial: "Em teste",
  active: "Pagantes",
  grace: "Em carência",
  blocked: "Bloqueados",
  unpublished: "Não publicados",
  disabled: "Acesso bloqueado",
};

export async function listSalonsForAdmin(params: { q?: string; filter?: SalonFilter } = {}, now: Date = new Date()) {
  const q = params.q?.trim();
  const filter = params.filter ?? "all";
  const where: Prisma.SalonWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { slug: { contains: q, mode: "insensitive" } },
          { owner: { email: { contains: q, mode: "insensitive" } } },
          { owner: { name: { contains: q, mode: "insensitive" } } },
        ],
      }
    : {};

  const salons = await prisma.salon.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      publishedAt: true,
      owner: { select: { id: true, name: true, email: true, phone: true, disabledAt: true } },
      subscription: true,
      _count: { select: { professionals: true, services: true, appointments: true } },
    },
  });

  return salons
    .map((s) => ({ ...s, access: getSubscriptionAccess(s.subscription, now) }))
    .filter((s) => {
      switch (filter) {
        case "trial":
          return s.subscription?.status === "TRIAL";
        case "active":
          return s.subscription?.status === "ACTIVE" && s.access !== "BLOCKED";
        case "grace":
          return s.access === "GRACE";
        case "blocked":
          return s.access === "BLOCKED";
        case "unpublished":
          return !s.publishedAt;
        case "disabled":
          return Boolean(s.owner.disabledAt);
        default:
          return true;
      }
    });
}

export async function getSalonForAdmin(salonId: string, now: Date = new Date()) {
  const salon = await prisma.salon.findUnique({
    where: { id: salonId },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      publishedAt: true,
      whatsappPhone: true,
      owner: {
        select: { id: true, name: true, email: true, phone: true, disabledAt: true, termsAcceptedAt: true, termsVersion: true, createdAt: true },
      },
      subscription: true,
      _count: { select: { professionals: true, services: true, clients: true, appointments: true } },
    },
  });
  if (!salon) return null;
  const [appointmentsLast30, lastAppointment] = await Promise.all([
    prisma.appointment.count({ where: { salonId, createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } } }),
    prisma.appointment.findFirst({ where: { salonId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);
  return {
    ...salon,
    access: getSubscriptionAccess(salon.subscription, now),
    appointmentsLast30,
    lastAppointmentAt: lastAppointment?.createdAt ?? null,
  };
}

// ------------------------------------------------------------
// Assinatura
// ------------------------------------------------------------

async function requireSubscription(salonId: string) {
  const sub = await prisma.subscription.findUnique({ where: { salonId } });
  if (!sub) throw new AdminError("NOT_FOUND", "Salão sem assinatura.");
  return sub;
}

/**
 * F6: soma a duração do plano a partir de max(agora, currentPeriodEnd) —
 * renovar antes do vencimento empilha o período em vez de perder os dias
 * restantes, e renovar depois de vencido conta a partir de hoje.
 */
export async function nextPeriodEnd(sub: { plan: SubscriptionPlan; currentPeriodEnd: Date | null }, now: Date = new Date()) {
  const base = sub.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
  return new Date(base.getTime() + (await planDurationDays(sub.plan)) * DAY_MS);
}

/** Conciliação manual do PIX: ativa (ou renova) um plano pago. */
export async function adminActivateSubscription(salonId: string, plan?: SubscriptionPlan, now: Date = new Date()) {
  const sub = await requireSubscription(salonId);
  const chosen = plan ?? sub.plan;
  if (chosen === "TRIAL") throw new AdminError("INVALID_INPUT", "Escolha um plano pago para ativar.");
  // Trocar de plano começa um período novo do zero; renovar o mesmo empilha.
  const base = chosen === sub.plan ? sub : { plan: chosen, currentPeriodEnd: null };
  return prisma.subscription.update({
    where: { salonId },
    data: {
      plan: chosen,
      status: "ACTIVE",
      activatedAt: now,
      activatedManuallyByEmail: "admin (painel /admin)",
      currentPeriodEnd: await nextPeriodEnd(base, now),
    },
  });
}

export async function adminSetSubscriptionStatus(salonId: string, status: SubscriptionStatus) {
  await requireSubscription(salonId);
  return prisma.subscription.update({ where: { salonId }, data: { status } });
}

/** Mais dias de teste, contados do fim atual (ou de hoje, se já acabou). */
export async function adminExtendTrial(salonId: string, days: number, now: Date = new Date()) {
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new AdminError("INVALID_INPUT", "Informe de 1 a 365 dias.");
  }
  const sub = await requireSubscription(salonId);
  const base = sub.trialEndsAt > now ? sub.trialEndsAt : now;
  return prisma.subscription.update({
    where: { salonId },
    data: {
      trialEndsAt: new Date(base.getTime() + days * DAY_MS),
      // Estender o teste de quem já não está em TRIAL volta pra TRIAL — senão
      // getSubscriptionAccess continuaria olhando o currentPeriodEnd.
      ...(sub.status !== "TRIAL" ? { status: "TRIAL", plan: "TRIAL" } : {}),
    },
  });
}

/** Edição livre (correções manuais): plano, status e datas. */
export async function adminUpdateSubscription(
  salonId: string,
  data: { plan: SubscriptionPlan; status: SubscriptionStatus; trialEndsAt: Date; currentPeriodEnd: Date | null }
) {
  await requireSubscription(salonId);
  if (Number.isNaN(data.trialEndsAt.getTime()) || (data.currentPeriodEnd && Number.isNaN(data.currentPeriodEnd.getTime()))) {
    throw new AdminError("INVALID_INPUT", "Data inválida.");
  }
  if (data.status === "ACTIVE" && !data.currentPeriodEnd) {
    throw new AdminError("INVALID_INPUT", "Assinatura ativa precisa da data de fim do período.");
  }
  return prisma.subscription.update({ where: { salonId }, data });
}

// ------------------------------------------------------------
// Salão e dono
// ------------------------------------------------------------

export async function adminSetPublished(salonId: string, published: boolean, now: Date = new Date()) {
  return prisma.salon.update({ where: { id: salonId }, data: { publishedAt: published ? now : null } });
}

/** Bloqueia/desbloqueia o login do dono (sessões abertas caem — ver getCurrentSalon). */
export async function adminSetOwnerDisabled(userId: string, disabled: boolean, now: Date = new Date()) {
  return prisma.user.update({ where: { id: userId }, data: { disabledAt: disabled ? now : null } });
}

export async function adminUpdateOwner(userId: string, data: { name: string; email: string; phone: string }) {
  const name = data.name.trim();
  const email = data.email.trim().toLowerCase();
  if (!name || !email || !email.includes("@")) {
    throw new AdminError("INVALID_INPUT", "Nome e e-mail válidos são obrigatórios.");
  }
  const other = await prisma.user.findUnique({ where: { email } });
  if (other && other.id !== userId) {
    throw new AdminError("EMAIL_TAKEN", "Já existe outra conta com esse e-mail.");
  }
  return prisma.user.update({
    where: { id: userId },
    data: { name, email, phone: data.phone.replace(/\D/g, "") || null },
  });
}

// ------------------------------------------------------------
// Planos da plataforma
// ------------------------------------------------------------

export async function adminUpdatePlatformPlan(
  plan: SubscriptionPlan,
  data: { label: string; priceCents: number; durationDays: number; description: string | null; active: boolean }
) {
  const label = data.label.trim();
  if (!label) throw new AdminError("INVALID_INPUT", "O nome do plano é obrigatório.");
  if (!Number.isInteger(data.priceCents) || data.priceCents < 0) throw new AdminError("INVALID_INPUT", "Preço inválido.");
  if (plan !== "TRIAL" && data.priceCents === 0) throw new AdminError("INVALID_INPUT", "Plano pago precisa de preço.");
  if (!Number.isInteger(data.durationDays) || data.durationDays < 1 || data.durationDays > 3650) {
    throw new AdminError("INVALID_INPUT", "Duração deve ser de 1 a 3650 dias.");
  }
  const values = {
    label,
    priceCents: plan === "TRIAL" ? 0 : data.priceCents,
    durationDays: data.durationDays,
    description: data.description?.trim() || null,
    // O teste grátis não sai do ar por aqui — ele é o que todo cadastro novo recebe.
    active: plan === "TRIAL" ? true : data.active,
  };
  if (plan !== "TRIAL" && !values.active) {
    const othersActive = await prisma.platformPlan.count({ where: { plan: { notIn: ["TRIAL", plan] }, active: true } });
    if (othersActive === 0) throw new AdminError("INVALID_INPUT", "Deixe pelo menos um plano pago à venda.");
  }
  return prisma.platformPlan.upsert({
    where: { plan },
    create: { plan, sortOrder: SUBSCRIPTION_PLANS.indexOf(plan), ...values },
    update: values,
  });
}

// ------------------------------------------------------------
// Notificações (Fase E5): aparelhos inscritos e entrega nos últimos 7 dias
// ------------------------------------------------------------

export async function getNotificationStats(params: { salonId?: string; now?: Date } = {}) {
  const now = params.now ?? new Date();
  const scope = params.salonId ? { salonId: params.salonId } : {};
  const since = new Date(now.getTime() - 7 * DAY_MS);
  const [staffDevices, clientDevices, byStatus] = await Promise.all([
    prisma.pushSubscription.count({ where: { ...scope, userId: { not: null } } }),
    prisma.pushSubscription.count({ where: { ...scope, clientId: { not: null } } }),
    prisma.notificationLog.groupBy({
      by: ["status"],
      where: { ...scope, createdAt: { gte: since }, type: { not: "TEST" } },
      _count: { _all: true },
    }),
  ]);
  const count = (status: "SENT" | "FAILED" | "NO_SUBSCRIPTION") => byStatus.find((s) => s.status === status)?._count._all ?? 0;
  const sent = count("SENT");
  const failed = count("FAILED");
  return {
    staffDevices,
    clientDevices,
    last7Days: { sent, failed, noSubscription: count("NO_SUBSCRIPTION") },
    // Entre quem tinha aparelho, quantos receberam.
    deliveryRate: sent + failed > 0 ? sent / (sent + failed) : null,
  };
}
