import { NextRequest, NextResponse } from "next/server";
import { cancelAppointmentByToken } from "@/lib/booking";
import { bookingErrorResponse } from "@/lib/bookingErrors";

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
  try {
    await cancelAppointmentByToken({ accessToken, actor: "CLIENT" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return bookingErrorResponse(err);
  }
}
