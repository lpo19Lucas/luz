import { redirect } from "next/navigation";
import { getSession, isSessionStillValid } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Salão do dono logado. Assume 1 salão por dono (spec: MVP mira 1 salão por
 * amigo, embora o schema já suporte User 1—N Salon pra Fase 2). Redireciona
 * pro login se não houver sessão válida — chamado a partir do layout do
 * dashboard, então toda página dentro dele já fica protegida.
 *
 * Também derruba a sessão (volta pro login) se o admin bloqueou a conta ou
 * se a senha foi trocada depois que essa sessão foi emitida.
 */
export async function getCurrentSalon() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const salon = await prisma.salon.findFirst({
    where: { ownerId: session.userId },
    orderBy: { createdAt: "asc" },
    include: { owner: { select: { disabledAt: true, passwordChangedAt: true } } },
  });

  if (!salon) {
    redirect("/cadastro");
  }
  if (!isSessionStillValid(session, salon.owner)) {
    redirect(salon.owner.disabledAt ? "/login?bloqueado=1" : "/login?expirada=1");
  }

  // Mantém o formato antigo (Salon puro) pra não mudar quem já usa.
  const { owner, ...rest } = salon;
  return rest;
}
