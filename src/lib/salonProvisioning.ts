import type { SubscriptionPlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateUniqueSalonSlug } from "@/lib/slug";
import { getTrialDays, planDurationDays } from "@/lib/plans";
import { LEGAL_VERSION } from "@/lib/legal";

/**
 * Cria conta + salão + assinatura + config de confirmação de presença numa
 * única transação. Usado pelo /cadastro (self-service) e pelo cadastro
 * facilitado do /admin. Antes o cadastro fazia 4 inserts soltos — se um
 * falhasse no meio, ficava um usuário com salão mas sem assinatura (o que
 * getSubscriptionAccess trata como BLOCKED).
 */

export class ProvisionError extends Error {
  constructor(public code: "EMAIL_TAKEN" | "INVALID_INPUT", message: string) {
    super(message);
  }
}

export const SERVICE_TEMPLATES = {
  barbearia: [
    { name: "Corte masculino", durationMinutes: 30, priceCents: 4000 },
    { name: "Barba", durationMinutes: 20, priceCents: 3000 },
    { name: "Corte + barba", durationMinutes: 50, priceCents: 6500 },
  ],
  salao: [
    { name: "Corte feminino", durationMinutes: 60, priceCents: 8000 },
    { name: "Escova", durationMinutes: 45, priceCents: 5000 },
    { name: "Manicure", durationMinutes: 40, priceCents: 3500 },
  ],
} as const;

export type ServiceTemplate = keyof typeof SERVICE_TEMPLATES;

export type ProvisionInput = {
  ownerName: string;
  email: string;
  phone?: string | null;
  passwordHash: string;
  salonName: string;
  /** Aceite dos Termos/Privacidade/Contrato registrado agora. No cadastro
   * facilitado fica false — o dono aceita ao definir a senha pelo convite. */
  termsAccepted: boolean;
  /** Padrão: TRIAL com os dias da linha TRIAL de platform_plans. */
  plan?: SubscriptionPlan;
  /** Só pro TRIAL: sobrescreve a duração padrão do teste. */
  trialDays?: number;
  serviceTemplate?: ServiceTemplate | null;
  /** Registrado em activatedManuallyByEmail quando já nasce com plano pago. */
  activatedBy?: string;
  now?: Date;
};

const DAY_MS = 24 * 60 * 60_000;

export async function provisionSalon(input: ProvisionInput) {
  const email = input.email.trim().toLowerCase();
  const ownerName = input.ownerName.trim();
  const salonName = input.salonName.trim();
  if (!email || !ownerName || !salonName) {
    throw new ProvisionError("INVALID_INPUT", "Preencha nome, e-mail e nome do salão.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ProvisionError("EMAIL_TAKEN", "Já existe uma conta com esse e-mail.");
  }

  const now = input.now ?? new Date();
  const plan = input.plan ?? "TRIAL";
  const trialDays = input.trialDays ?? (await getTrialDays());
  const paidDays = plan === "TRIAL" ? 0 : await planDurationDays(plan);
  const slug = await generateUniqueSalonSlug(salonName);
  const services = input.serviceTemplate ? SERVICE_TEMPLATES[input.serviceTemplate] : [];

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: ownerName,
        email,
        phone: input.phone?.replace(/\D/g, "") || null,
        passwordHash: input.passwordHash,
        ...(input.termsAccepted ? { termsAcceptedAt: now, termsVersion: LEGAL_VERSION } : {}),
      },
    });
    const salon = await tx.salon.create({ data: { name: salonName, slug, ownerId: user.id } });

    await tx.subscription.create({
      data: {
        salonId: salon.id,
        plan,
        status: plan === "TRIAL" ? "TRIAL" : "ACTIVE",
        trialEndsAt: new Date(now.getTime() + trialDays * DAY_MS),
        ...(plan === "TRIAL"
          ? {}
          : {
              currentPeriodEnd: new Date(now.getTime() + paidDays * DAY_MS),
              activatedAt: now,
              activatedManuallyByEmail: input.activatedBy ?? "admin (cadastro facilitado)",
            }),
      },
    });
    await tx.presenceConfirmationConfig.create({
      data: { salonId: salon.id, enabled: true, hoursBefore: 24, actionOnNoConfirm: "ALERT_ONLY" },
    });
    if (services.length > 0) {
      await tx.service.createMany({ data: services.map((s) => ({ ...s, salonId: salon.id })) });
    }

    return { user, salon };
  });
}
