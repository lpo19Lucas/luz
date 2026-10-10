"use server";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createAdminSession, createSession, destroyAdminSession, getAdminSession, hashPassword } from "@/lib/auth";
import { isRateLimited, recordAuthAttempt, clientIpFromHeaders, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";
import { createPasswordToken } from "@/lib/passwordReset";
import { provisionSalon, ProvisionError } from "@/lib/salonProvisioning";
import { getSegment, isSegmentSlug } from "@/lib/segments";
import { whatsappLink } from "@/lib/phone";
import { salonEndOfDayUTC } from "@/lib/timezone";
import {
  AdminError,
  adminActivateSubscription,
  adminExtendTrial,
  adminSetOwnerDisabled,
  adminSetPublished,
  adminSetSubscriptionStatus,
  adminUpdateOwner,
  adminUpdatePlatformPlan,
  adminUpdateSubscription,
  isSubscriptionPlan,
  isSubscriptionStatus,
} from "@/lib/adminSalons";

export type FormState = { error: string } | undefined;
export type AdminFormState =
  | { error?: string; success?: string; link?: string; whatsappHref?: string | null; salonId?: string }
  | undefined;

/** Comparação em tempo constante — não vaza pelo tempo de resposta quantos
 * caracteres da senha estão certos. */
function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Toda action do admin passa por aqui. Server actions são endpoints HTTP
 * públicos — o layout protegido não protege a action em si (a versão
 * anterior de setSubscriptionStatusAction não checava e podia ser chamada
 * por qualquer um).
 */
async function requireAdmin() {
  if (!(await getAdminSession())) redirect("/admin/login");
}

function str(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

/** "YYYY-MM-DD" do input type=date → fim daquele dia em Brasília. */
function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return salonEndOfDayUTC(new Date(`${value}T00:00:00Z`));
}

function revalidateSalon(salonId: string) {
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/saloes/${salonId}`);
}

function toState(err: unknown): AdminFormState {
  if (err instanceof AdminError || err instanceof ProvisionError) return { error: err.message };
  throw err;
}

// ------------------------------------------------------------
// Login
// ------------------------------------------------------------

export async function adminLoginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return { error: "ADMIN_PASSWORD não configurada no servidor (ver .env.example)." };
  }
  const key = `admin:${clientIpFromHeaders(await headers())}`;
  if (await isRateLimited(key)) {
    return { error: RATE_LIMIT_MESSAGE };
  }
  const ok = safeEqual(password, expected);
  await recordAuthAttempt(key, ok);
  if (!ok) {
    return { error: "Senha incorreta." };
  }

  await createAdminSession();
  redirect("/admin");
}

export async function adminLogoutAction() {
  await destroyAdminSession();
  redirect("/admin/login");
}

// ------------------------------------------------------------
// Assinatura
// ------------------------------------------------------------

/** Conciliação manual do PIX — ativa/renova (opcionalmente trocando de plano). */
export async function activateSubscriptionAction(formData: FormData) {
  await requireAdmin();
  const salonId = str(formData, "salonId");
  const plan = str(formData, "plan");
  await adminActivateSubscription(salonId, isSubscriptionPlan(plan) ? plan : undefined);
  revalidateSalon(salonId);
}

export async function setSubscriptionStatusAction(formData: FormData) {
  await requireAdmin();
  const salonId = str(formData, "salonId");
  const status = str(formData, "status");
  if (!isSubscriptionStatus(status)) return;
  await adminSetSubscriptionStatus(salonId, status);
  revalidateSalon(salonId);
}

export async function extendTrialAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const salonId = str(formData, "salonId");
  try {
    const sub = await adminExtendTrial(salonId, Number(str(formData, "days")));
    revalidateSalon(salonId);
    return { success: `Teste estendido até ${sub.trialEndsAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.` };
  } catch (err) {
    return toState(err);
  }
}

export async function updateSubscriptionAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const salonId = str(formData, "salonId");
  const plan = str(formData, "plan");
  const status = str(formData, "status");
  const trialEndsAt = parseDateInput(str(formData, "trialEndsAt"));
  const periodRaw = str(formData, "currentPeriodEnd");
  const currentPeriodEnd = periodRaw ? parseDateInput(periodRaw) : null;
  if (!isSubscriptionPlan(plan) || !isSubscriptionStatus(status) || !trialEndsAt || (periodRaw && !currentPeriodEnd)) {
    return { error: "Preencha plano, status e datas válidas." };
  }
  try {
    await adminUpdateSubscription(salonId, { plan, status, trialEndsAt, currentPeriodEnd });
    revalidateSalon(salonId);
    return { success: "Assinatura atualizada." };
  } catch (err) {
    return toState(err);
  }
}

// ------------------------------------------------------------
// Salão e dono
// ------------------------------------------------------------

export async function setPublishedAction(formData: FormData) {
  await requireAdmin();
  const salonId = str(formData, "salonId");
  await adminSetPublished(salonId, str(formData, "published") === "true");
  revalidateSalon(salonId);
}

export async function setOwnerDisabledAction(formData: FormData) {
  await requireAdmin();
  const salonId = str(formData, "salonId");
  const salon = await prisma.salon.findUniqueOrThrow({ where: { id: salonId }, select: { ownerId: true } });
  await adminSetOwnerDisabled(salon.ownerId, str(formData, "disabled") === "true");
  revalidateSalon(salonId);
}

export async function updateOwnerAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const salonId = str(formData, "salonId");
  const salon = await prisma.salon.findUniqueOrThrow({ where: { id: salonId }, select: { ownerId: true } });
  try {
    await adminUpdateOwner(salon.ownerId, { name: str(formData, "name"), email: str(formData, "email"), phone: str(formData, "phone") });
    revalidateSalon(salonId);
    return { success: "Dados do dono atualizados." };
  } catch (err) {
    return toState(err);
  }
}

/**
 * Gera link de redefinição de senha (ou convite) pra mandar manualmente —
 * funciona mesmo sem e-mail configurado. O link aparece uma vez só na tela.
 */
export async function generateAccessLinkAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const salonId = str(formData, "salonId");
  const salon = await prisma.salon.findUniqueOrThrow({
    where: { id: salonId },
    select: { name: true, owner: { select: { id: true, name: true, phone: true, termsVersion: true } } },
  });
  // Quem nunca aceitou os termos (convite) ganha o link de 7 dias.
  const purpose = salon.owner.termsVersion ? "RESET" : "INVITE";
  const { link, expiresInLabel } = await createPasswordToken(salon.owner.id, purpose);
  const text = `Olá, ${salon.owner.name}! Aqui está o link para definir sua senha de acesso à DLJ Innovations (${salon.name}): ${link} — vale por ${expiresInLabel}.`;
  return { link, whatsappHref: salon.owner.phone ? whatsappLink(salon.owner.phone, text) : null, success: `Link válido por ${expiresInLabel}.` };
}

/** Suporte: entra no painel como o dono do salão (abre sessão de dono). */
export async function impersonateOwnerAction(formData: FormData) {
  await requireAdmin();
  const salonId = str(formData, "salonId");
  const salon = await prisma.salon.findUniqueOrThrow({
    where: { id: salonId },
    select: { owner: { select: { id: true, disabledAt: true } } },
  });
  if (salon.owner.disabledAt) return;
  console.info(`[admin] entrou como o dono do salão ${salonId}`);
  await createSession(salon.owner.id);
  redirect("/agenda");
}

/**
 * Cadastro facilitado: cria dono + salão + assinatura e devolve o link de
 * convite (7 dias) pro dono definir a senha e aceitar os termos.
 */
export async function createSalonAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const plan = str(formData, "plan") || "TRIAL";
  const trialDaysRaw = str(formData, "trialDays");
  const segmentRaw = str(formData, "segment") || "barbearia";
  if (!isSegmentSlug(segmentRaw) || !getSegment(segmentRaw).available) return { error: "Segmento inválido." };
  if (!isSubscriptionPlan(plan)) return { error: "Plano inválido." };
  const trialDays = trialDaysRaw ? Number(trialDaysRaw) : undefined;
  if (trialDays !== undefined && (!Number.isInteger(trialDays) || trialDays < 1 || trialDays > 365)) {
    return { error: "Dias de teste: de 1 a 365." };
  }

  try {
    const { user, salon } = await provisionSalon({
      ownerName: str(formData, "ownerName"),
      email: str(formData, "email"),
      phone: str(formData, "phone"),
      // Senha aleatória inutilizável — o dono define a dele pelo convite.
      passwordHash: await hashPassword(randomBytes(32).toString("hex")),
      salonName: str(formData, "salonName"),
      termsAccepted: false,
      plan,
      trialDays,
      segment: segmentRaw,
      withSampleServices: formData.get("withSampleServices") === "on",
      activatedBy: "admin (cadastro facilitado)",
    });
    const { link } = await createPasswordToken(user.id, "INVITE");
    const text = `Olá, ${user.name}! Seu salão ${salon.name} já está cadastrado na DLJ Innovations. Crie sua senha por este link (vale 7 dias): ${link}`;
    revalidatePath("/admin", "layout");
    return {
      success: `Salão "${salon.name}" criado.`,
      salonId: salon.id,
      link,
      whatsappHref: user.phone ? whatsappLink(user.phone, text) : null,
    };
  } catch (err) {
    return toState(err);
  }
}

// ------------------------------------------------------------
// Planos
// ------------------------------------------------------------

export async function updatePlatformPlanAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await requireAdmin();
  const plan = str(formData, "plan");
  if (!isSubscriptionPlan(plan)) return { error: "Plano inválido." };
  const price = Number(str(formData, "price").replace(",", "."));
  try {
    await adminUpdatePlatformPlan(plan, {
      label: str(formData, "label"),
      priceCents: Number.isFinite(price) ? Math.round(price * 100) : NaN,
      durationDays: Number(str(formData, "durationDays")),
      description: str(formData, "description") || null,
      active: formData.get("active") === "on",
    });
    revalidatePath("/admin/planos");
    revalidatePath("/");
    revalidatePath("/assinatura");
    return { success: "Plano salvo." };
  } catch (err) {
    return toState(err);
  }
}
