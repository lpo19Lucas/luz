import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveMember, type Member } from "@/lib/members";

/**
 * Salão do DONO logado. Assume 1 salão por dono (spec: MVP mira 1 salão por
 * amigo, embora o schema já suporte User 1—N Salon pra Fase 2). Chamado a
 * partir do layout do dashboard e de toda action do dono, então tudo dentro
 * dele fica protegido.
 *
 * - Sem sessão válida (inclusive conta bloqueada ou senha trocada depois da
 *   emissão): volta pro login.
 * - Profissional com acesso (Fase P): vai pra /minha-agenda — nunca recebe o
 *   salão por aqui, então não alcança nenhuma tela/action do dono.
 */
export async function getCurrentSalon() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const member = await resolveMember(session);
  if (member?.role === "OWNER") return member.salon;
  if (member?.role === "PROFESSIONAL") redirect("/minha-agenda");

  // Sem salão: sessão inválida (bloqueada/senha trocada) ou conta sem salão.
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { disabledAt: true, passwordChangedAt: true } });
  if (!user) redirect("/login");
  if (user.disabledAt) redirect("/login?bloqueado=1");
  if (user.passwordChangedAt && session.issuedAt < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    redirect("/login?expirada=1");
  }
  // Conta sem salão e sem vínculo de profissional: como o cadastro de dono
  // sempre cria o salão junto (provisionSalon), é um profissional cujo acesso
  // foi retirado.
  redirect("/login?sem-acesso=1");
}

/** Dono OU profissional logado — pras telas/ações que os dois podem usar. */
export async function getCurrentMember(): Promise<Member> {
  const session = await getSession();
  const member = await resolveMember(session);
  if (!member) redirect(session ? "/login?expirada=1" : "/login");
  return member;
}

/** Só profissional — área /minha-agenda. Dono é mandado pra agenda completa. */
export async function getCurrentProfessional() {
  const member = await getCurrentMember();
  if (member.role !== "PROFESSIONAL") redirect("/agenda");
  return member;
}
