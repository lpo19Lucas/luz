import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/appointments/:accessToken/confirm-presence
 *
 * Confirmação de presença via link único (spec seção 8.6, requisito P0.10).
 * Importante: isso é o cliente clicando num botão na página — nunca uma
 * resposta de WhatsApp. O canal continua unidirecional (non-goal da spec).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ accessToken: string }> }
) {
  const { accessToken } = await params;
  const appointment = await prisma.appointment.findUnique({
    where: { accessToken },
  });

  if (!appointment) {
    return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
  }
  if (appointment.status !== "AWAITING_CONFIRMATION" && appointment.status !== "CONFIRMED") {
    return NextResponse.json(
      { error: "Esse agendamento não pode mais ser confirmado" },
      { status: 409 }
    );
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "CONFIRMED" },
  });

  return NextResponse.json({ ok: true });
}
