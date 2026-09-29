import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/appointments/:accessToken/cancel
 *
 * Cancelamento pelo cliente via link único — sem login (spec seção 8.7).
 * O token É a autenticação: quem tem o link, gerencia o agendamento.
 * Sem restrição de antecedência mínima no MVP (non-goal documentado).
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
  if (appointment.status === "CANCELLED") {
    return NextResponse.json({ error: "Agendamento já estava cancelado" }, { status: 409 });
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "CANCELLED" },
  });

  // TODO: cancelar os jobs de WhatsApp PENDING desse agendamento (REMINDER,
  // PRESENCE_CHECK) — não faz sentido lembrar/pedir confirmação de um
  // horário cancelado. Fica pra quando a fila estiver implementada de verdade.

  return NextResponse.json({ ok: true });
}
