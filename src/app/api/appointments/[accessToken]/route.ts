import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    include: { salon: true, professional: true, service: true, client: true },
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
    professionalName: appointment.professional.name,
    serviceName: appointment.service.name,
    clientName: appointment.client.name,
  });
}
