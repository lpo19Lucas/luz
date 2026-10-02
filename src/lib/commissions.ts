import { prisma } from "@/lib/prisma";

export interface CommissionRow {
  professionalId: string;
  professionalName: string;
  appointmentsCount: number;
  totalRevenueCents: number;
  commissionPercent: number | null;
  commissionCents: number | null; // null = profissional sem % configurada
}

/**
 * Comissão por profissional (feature "Comissão por profissional"): soma o
 * preço do serviço nos atendimentos COMPLETED no período, por profissional —
 * mesma base de clientStats/agendaKpis, mas sem excluir coveredByPackage: o
 * profissional prestou o serviço independente de como o cliente pagou.
 * `from`/`to` opcionais = todo o histórico.
 */
export async function getCommissionReport(params: { salonId: string; from?: Date; to?: Date }): Promise<CommissionRow[]> {
  const appointments = await prisma.appointment.findMany({
    where: {
      salonId: params.salonId,
      status: "COMPLETED",
      ...(params.from || params.to
        ? { startAt: { ...(params.from ? { gte: params.from } : {}), ...(params.to ? { lte: params.to } : {}) } }
        : {}),
    },
    include: { service: true, professional: true },
  });

  const byProfessional = new Map<string, CommissionRow>();
  for (const appt of appointments) {
    const row = byProfessional.get(appt.professionalId) ?? {
      professionalId: appt.professionalId,
      professionalName: appt.professional.name,
      appointmentsCount: 0,
      totalRevenueCents: 0,
      commissionPercent: appt.professional.commissionPercent,
      commissionCents: appt.professional.commissionPercent !== null ? 0 : null,
    };
    row.appointmentsCount += 1;
    row.totalRevenueCents += appt.service.priceCents;
    if (row.commissionCents !== null) {
      row.commissionCents += Math.round(appt.service.priceCents * (appt.professional.commissionPercent! / 100));
    }
    byProfessional.set(appt.professionalId, row);
  }

  return [...byProfessional.values()].sort((a, b) => b.totalRevenueCents - a.totalRevenueCents);
}
