import { NextRequest, NextResponse } from "next/server";
import { rescheduleAppointmentByToken } from "@/lib/booking";
import { bookingErrorResponse } from "@/lib/bookingErrors";

/**
 * POST /api/appointments/:accessToken/reschedule
 *
 * Reagendamento via link único — mesma autenticação por token do cancelar e
 * confirmar presença (spec 8.7). Mantém profissional e serviço, só troca o
 * horário; o link/token continua o mesmo (não gera um novo agendamento).
 */

interface RescheduleBody {
  startAt: string; // ISO string
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ accessToken: string }> }
) {
  const { accessToken } = await params;
  const body = (await req.json()) as RescheduleBody;

  try {
    const updated = await rescheduleAppointmentByToken({
      accessToken,
      newStartAt: new Date(body.startAt),
      actor: "CLIENT",
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      startAt: updated.startAt.toISOString(),
      endAt: updated.endAt.toISOString(),
    });
  } catch (err) {
    return bookingErrorResponse(err);
  }
}
