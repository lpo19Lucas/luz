import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDiscreetSalon } from "@/lib/discreet";
import { calendarLinksFor } from "@/lib/calendarLinks";

/**
 * GET /api/appointments/:accessToken
 *
 * Detalhes de um agendamento pra tela de gestão sem login (spec 8.6/8.7) —
 * o token na URL é a autenticação.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ accessToken: string }> }
) {
  const { accessToken } = await params;
  const appointment = await prisma.appointment.findUnique({
    where: { accessToken },
    include: { salon: true, professional: true, service: true, client: true, review: true },
  });

  if (!appointment) {
    return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    id: appointment.id,
    status: appointment.status,
    startAt: appointment.startAt.toISOString(),
    endAt: appointment.endAt.toISOString(),
    salonName: appointment.salon.name,
    salonSlug: appointment.salon.slug,
    professionalId: appointment.professionalId,
    professionalName: appointment.professional.name,
    serviceId: appointment.serviceId,
    serviceName: appointment.service.name,
    clientName: appointment.client.name,
    rescheduledCount: appointment.rescheduledCount,
    hasReview: appointment.review !== null,
    canReview: appointment.status === "COMPLETED" && appointment.review === null && !isDiscreetSalon(appointment.salon),
    calendar: calendarLinksFor(appointment),
  });
}
