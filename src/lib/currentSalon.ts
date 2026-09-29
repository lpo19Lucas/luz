import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Salão do dono logado. Assume 1 salão por dono (spec: MVP mira 1 salão por
 * amigo, embora o schema já suporte User 1—N Salon pra Fase 2). Redireciona
 * pro login se não houver sessão válida — chamado a partir do layout do
 * dashboard, então toda página dentro dele já fica protegida.
 */
export async function getCurrentSalon() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const salon = await prisma.salon.findFirst({
    where: { ownerId: session.userId },
    orderBy: { createdAt: "asc" },
  });

  if (!salon) {
    redirect("/cadastro");
  }

  return salon;
}
