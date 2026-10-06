import { createHash, randomBytes } from "node:crypto";
import type { PasswordTokenPurpose } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { absoluteUrl } from "@/lib/appUrl";
import { sendEmail, passwordResetEmail } from "@/lib/email";
import { validateNewPassword } from "@/lib/passwordPolicy";
import { LEGAL_VERSION } from "@/lib/legal";
import { needsTermsAcceptance } from "@/lib/termsAcceptance";

/**
 * Recuperação de acesso do dono.
 *
 * - "Esqueci minha senha": link por e-mail, válido por 1h.
 * - Admin: gera o mesmo link (RESET) ou um convite (INVITE, 7 dias) pra
 *   enviar manualmente por WhatsApp — funciona mesmo sem e-mail configurado.
 *
 * Só o SHA-256 do token vai pro banco: quem ler o banco não consegue montar
 * um link válido. Um token novo invalida os anteriores ainda não usados.
 */

export const TOKEN_TTL_MS: Record<PasswordTokenPurpose, number> = {
  RESET: 60 * 60_000, // 1 hora
  INVITE: 7 * 24 * 60 * 60_000, // 7 dias
};
const TTL_LABEL: Record<PasswordTokenPurpose, string> = { RESET: "1 hora", INVITE: "7 dias" };

// Um pedido de "esqueci a senha" a cada 2 min por conta — evita usar o
// formulário pra encher a caixa de alguém de e-mails.
export const RESET_REQUEST_COOLDOWN_MS = 2 * 60_000;

export class PasswordResetError extends Error {
  constructor(
    public code: "INVALID_TOKEN" | "WEAK_PASSWORD" | "TERMS_REQUIRED" | "WRONG_PASSWORD",
    message: string
  ) {
    super(message);
  }
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function passwordTokenLink(token: string) {
  return absoluteUrl(`/redefinir-senha/${token}`);
}

/** Cria o token e devolve o valor em claro (só existe no link). */
export async function createPasswordToken(userId: string, purpose: PasswordTokenPurpose, now: Date = new Date()) {
  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: { userId, purpose, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + TOKEN_TTL_MS[purpose]), createdAt: now },
    }),
  ]);
  return { token, link: passwordTokenLink(token), expiresInLabel: TTL_LABEL[purpose] };
}

/**
 * "Esqueci minha senha". Sempre termina igual pra quem chamou (não revela se
 * o e-mail tem conta) — o retorno é só pra teste/log.
 */
export async function requestPasswordReset(
  rawEmail: string,
  now: Date = new Date()
): Promise<{ status: "SENT" | "NOT_DELIVERED" | "NO_ACCOUNT" | "COOLDOWN" }> {
  const email = rawEmail.trim().toLowerCase();
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (!user || user.disabledAt) return { status: "NO_ACCOUNT" };

  const recent = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, createdAt: { gt: new Date(now.getTime() - RESET_REQUEST_COOLDOWN_MS) } },
  });
  if (recent) return { status: "COOLDOWN" };

  const { link, expiresInLabel } = await createPasswordToken(user.id, "RESET", now);
  const { delivered } = await sendEmail({ to: user.email, ...passwordResetEmail({ name: user.name, link, expiresInLabel }) });
  return { status: delivered ? "SENT" : "NOT_DELIVERED" };
}

/** Token válido (existe, não usado, não expirado) com o dono — ou null. */
export async function findValidPasswordToken(token: string, now: Date = new Date()) {
  if (!token) return null;
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true, termsVersion: true, disabledAt: true } } },
  });
  if (!record || record.usedAt || record.expiresAt <= now || record.user.disabledAt) return null;
  return record;
}

/** O link precisa pedir o aceite dos termos? (convite, conta antiga ou versão nova dos termos) */
export function tokenRequiresTerms(record: { user: { termsVersion: string | null } }) {
  return needsTermsAcceptance(record.user);
}

/**
 * Define a senha nova a partir do link. Marca o token como usado e grava
 * passwordChangedAt — o que derruba qualquer sessão emitida antes (ver
 * isSessionStillValid). Devolve o userId pra quem chamou abrir a sessão.
 */
export async function resetPasswordWithToken(params: {
  token: string;
  password: string;
  confirmation?: string;
  acceptTerms?: boolean;
  now?: Date;
}): Promise<{ userId: string; purpose: PasswordTokenPurpose }> {
  const now = params.now ?? new Date();
  const record = await findValidPasswordToken(params.token, now);
  if (!record) {
    throw new PasswordResetError("INVALID_TOKEN", "Este link expirou ou já foi usado. Peça um novo.");
  }
  const weak = validateNewPassword(params.password, params.confirmation);
  if (weak) throw new PasswordResetError("WEAK_PASSWORD", weak);
  const needsTerms = tokenRequiresTerms(record);
  if (needsTerms && !params.acceptTerms) {
    throw new PasswordResetError("TERMS_REQUIRED", "Aceite os Termos de Uso, a Política de Privacidade e o Contrato para continuar.");
  }

  const passwordHash = await hashPassword(params.password);
  // updateMany com usedAt: null garante uso único mesmo com dois envios
  // simultâneos do mesmo link.
  const claimed = await prisma.passwordResetToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: now },
  });
  if (claimed.count === 0) {
    throw new PasswordResetError("INVALID_TOKEN", "Este link expirou ou já foi usado. Peça um novo.");
  }
  await prisma.user.update({
    where: { id: record.userId },
    data: {
      passwordHash,
      passwordChangedAt: now,
      ...(needsTerms ? { termsAcceptedAt: now, termsVersion: LEGAL_VERSION } : {}),
    },
  });
  return { userId: record.userId, purpose: record.purpose };
}

/** Troca de senha pelo próprio dono logado (Configurações). */
export async function changePassword(params: {
  userId: string;
  currentPassword: string;
  newPassword: string;
  confirmation: string;
  now?: Date;
}) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: params.userId } });
  if (!(await verifyPassword(params.currentPassword, user.passwordHash))) {
    throw new PasswordResetError("WRONG_PASSWORD", "Senha atual incorreta.");
  }
  const weak = validateNewPassword(params.newPassword, params.confirmation);
  if (weak) throw new PasswordResetError("WEAK_PASSWORD", weak);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(params.newPassword), passwordChangedAt: params.now ?? new Date() },
  });
}
