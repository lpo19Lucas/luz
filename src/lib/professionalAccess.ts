import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { createPasswordToken } from "@/lib/passwordReset";
import { whatsappLink } from "@/lib/phone";
import { needsTermsAcceptance } from "@/lib/termsAcceptance";
import { salonCalendarDay } from "@/lib/timezone";

/**
 * Acesso do profissional (Fase P). O dono convida pelo e-mail: cria a conta
 * (sem senha utilizável) e devolve o link de convite pra mandar no WhatsApp.
 * O profissional define a senha, aceita os termos e cai em /minha-agenda, onde
 * vê só os próprios atendimentos e recebe as próprias notificações.
 */

export class ProfessionalAccessError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID_INPUT" | "ALREADY_LINKED" | "EMAIL_IS_OWNER", message: string) {
    super(message);
  }
}

function inviteMessage(params: { name: string; salonName: string; link: string; expiresInLabel: string }) {
  return `Olá, ${params.name}! Você foi convidado(a) para ver sua agenda do ${params.salonName} na Luz e receber os seus agendamentos no celular. Crie sua senha por este link (vale ${params.expiresInLabel}): ${params.link}`;
}

async function linkFor(user: { id: string; termsVersion: string | null }, professional: { name: string; phone: string | null }, salonName: string) {
  const { link, expiresInLabel } = await createPasswordToken(user.id, needsTermsAcceptance(user) ? "INVITE" : "RESET");
  const text = inviteMessage({ name: professional.name, salonName, link, expiresInLabel });
  return { link, expiresInLabel, whatsappHref: professional.phone ? whatsappLink(professional.phone, text) : null };
}

export async function grantProfessionalAccess(params: { salonId: string; professionalId: string; email: string; phone?: string | null }) {
  const email = params.email.trim().toLowerCase();
  if (!email.includes("@")) throw new ProfessionalAccessError("INVALID_INPUT", "Informe um e-mail válido.");

  const professional = await prisma.professional.findFirst({
    where: { id: params.professionalId, salonId: params.salonId },
    include: { salon: { select: { name: true, ownerId: true } } },
  });
  if (!professional) throw new ProfessionalAccessError("NOT_FOUND", "Profissional não encontrado.");
  if (professional.userId) throw new ProfessionalAccessError("ALREADY_LINKED", "Este profissional já tem acesso.");

  let user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    // Dono entra sempre como dono (ver resolveMember) — nunca veria esta agenda.
    const ownsSalon = await prisma.salon.count({ where: { ownerId: user.id } });
    if (ownsSalon > 0) {
      throw new ProfessionalAccessError("EMAIL_IS_OWNER", "Esse e-mail é de uma conta de dono de salão. Use outro e-mail para o profissional.");
    }
    const linkedHere = await prisma.professional.count({ where: { salonId: params.salonId, userId: user.id } });
    if (linkedHere > 0) throw new ProfessionalAccessError("ALREADY_LINKED", "Esse e-mail já dá acesso a outro profissional deste salão.");
  } else {
    user = await prisma.user.create({
      data: { name: professional.name, email, passwordHash: await hashPassword(randomBytes(32).toString("hex")) },
    });
  }

  const phone = params.phone?.replace(/\D/g, "") || professional.phone;
  const updated = await prisma.professional.update({ where: { id: professional.id }, data: { userId: user.id, phone } });
  return { userId: user.id, ...(await linkFor(user, updated, professional.salon.name)) };
}

/** Novo link de senha pro profissional (esqueceu a senha / convite expirou). */
export async function resendProfessionalLink(salonId: string, professionalId: string) {
  const professional = await prisma.professional.findFirst({
    where: { id: professionalId, salonId },
    include: { user: { select: { id: true, termsVersion: true } }, salon: { select: { name: true } } },
  });
  if (!professional?.user) throw new ProfessionalAccessError("NOT_FOUND", "Este profissional não tem acesso.");
  return linkFor(professional.user, professional, professional.salon.name);
}

/** Tira o acesso: desvincula a conta e apaga os aparelhos dela neste salão. */
export async function revokeProfessionalAccess(salonId: string, professionalId: string) {
  const professional = await prisma.professional.findFirst({ where: { id: professionalId, salonId } });
  if (!professional?.userId) return;
  await prisma.$transaction([
    prisma.pushSubscription.deleteMany({ where: { salonId, userId: professional.userId } }),
    prisma.professional.update({ where: { id: professional.id }, data: { userId: null } }),
  ]);
}

/**
 * Agenda do profissional: de hoje até `days` dias à frente (calendário de
 * Brasília), mais os de dias anteriores ainda sem desfecho marcado.
 */
export async function getProfessionalAgenda(professionalId: string, days = 14, now: Date = new Date()) {
  const todayStart = new Date(salonCalendarDay(now).getTime() + 3 * 60 * 60_000); // 00:00 de Brasília em UTC
  const end = new Date(todayStart.getTime() + days * 24 * 60 * 60_000);
  return prisma.appointment.findMany({
    where: {
      professionalId,
      OR: [
        { startAt: { gte: todayStart, lt: end }, status: { not: "CANCELLED" } },
        { startAt: { lt: todayStart, gte: new Date(todayStart.getTime() - 7 * 24 * 60 * 60_000) }, status: { in: ["CONFIRMED", "AWAITING_CONFIRMATION"] } },
      ],
    },
    orderBy: { startAt: "asc" },
    include: { service: { select: { name: true, durationMinutes: true } }, client: { select: { name: true, phone: true } }, asset: true },
  });
}
