import type { Professional, Salon } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSessionStillValid } from "@/lib/auth";

/**
 * Quem está logado (Fase P): o DONO do salão ou um PROFISSIONAL com acesso
 * (Professional.userId). Dono tem precedência — quem é dono de um salão e
 * profissional em outro entra como dono.
 *
 * Regra de segurança: getCurrentSalon() (usado por todas as telas e actions
 * do dono) continua só pro dono — o profissional é mandado pra /minha-agenda.
 * Assim toda action existente segue protegida sem precisar mexer nela; só o
 * que o profissional pode fazer usa getCurrentMember().
 */

export type Member =
  | { role: "OWNER"; userId: string; salon: Salon }
  | { role: "PROFESSIONAL"; userId: string; salon: Salon; professional: Professional };

export async function resolveMember(session: { userId: string; issuedAt: number } | null): Promise<Member | null> {
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, disabledAt: true, passwordChangedAt: true },
  });
  if (!user || !isSessionStillValid(session, user)) return null;

  const salon = await prisma.salon.findFirst({ where: { ownerId: user.id }, orderBy: { createdAt: "asc" } });
  if (salon) return { role: "OWNER", userId: user.id, salon };

  const professional = await prisma.professional.findFirst({
    where: { userId: user.id, active: true },
    orderBy: { name: "asc" },
    include: { salon: true },
  });
  if (professional) {
    const { salon: proSalon, ...pro } = professional;
    return { role: "PROFESSIONAL", userId: user.id, salon: proSalon, professional: pro };
  }
  return null;
}
