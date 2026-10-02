import { prisma } from "@/lib/prisma";

export interface ClientStats {
  visitCount: number; // COMPLETED
  noShowCount: number;
  totalSpentCents: number; // soma dos COMPLETED
  averageTicketCents: number;
  lastVisitAt: Date | null; // startAt do COMPLETED mais recente
}

/** Faturamento por cliente (F1): visitas, total gasto, ticket médio, última
 * visita (só conta atendimento COMPLETED — o mesmo critério das Métricas) e
 * faltas. */
export async function getClientStats(salonId: string, clientId: string): Promise<ClientStats> {
  const appointments = await prisma.appointment.findMany({
    where: { salonId, clientId, status: { in: ["COMPLETED", "NO_SHOW"] } },
    include: { service: true },
    orderBy: { startAt: "desc" },
  });

  const completed = appointments.filter((a) => a.status === "COMPLETED");
  const noShowCount = appointments.filter((a) => a.status === "NO_SHOW").length;
  // Atendimento coberto por pacote já entrou na receita quando o pacote foi
  // vendido (ver src/lib/packages.ts) — contar de novo aqui duplicaria.
  const totalSpentCents = completed
    .filter((a) => !a.coveredByPackage)
    .reduce((sum, a) => sum + a.service.priceCents, 0);

  return {
    visitCount: completed.length,
    noShowCount,
    totalSpentCents,
    averageTicketCents: completed.length > 0 ? totalSpentCents / completed.length : 0,
    lastVisitAt: completed[0]?.startAt ?? null,
  };
}

/** Mesma coisa, mas pra todos os clientes do salão de uma vez (lista /clientes). */
export async function getAllClientStats(salonId: string): Promise<Map<string, ClientStats>> {
  const appointments = await prisma.appointment.findMany({
    where: { salonId, status: { in: ["COMPLETED", "NO_SHOW"] } },
    include: { service: true },
    orderBy: { startAt: "desc" },
  });

  const byClient = new Map<string, typeof appointments>();
  for (const appt of appointments) {
    const list = byClient.get(appt.clientId) ?? [];
    list.push(appt);
    byClient.set(appt.clientId, list);
  }

  const stats = new Map<string, ClientStats>();
  for (const [clientId, appts] of byClient) {
    const completed = appts.filter((a) => a.status === "COMPLETED");
    const noShowCount = appts.filter((a) => a.status === "NO_SHOW").length;
    const totalSpentCents = completed
      .filter((a) => !a.coveredByPackage)
      .reduce((sum, a) => sum + a.service.priceCents, 0);
    stats.set(clientId, {
      visitCount: completed.length,
      noShowCount,
      totalSpentCents,
      averageTicketCents: completed.length > 0 ? totalSpentCents / completed.length : 0,
      lastVisitAt: completed[0]?.startAt ?? null,
    });
  }
  return stats;
}
