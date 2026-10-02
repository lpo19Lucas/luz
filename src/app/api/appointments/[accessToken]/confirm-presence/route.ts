import { NextRequest, NextResponse } from "next/server";
import { confirmPresenceByToken } from "@/lib/booking";
import { bookingErrorResponse } from "@/lib/bookingErrors";

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
  try {
    await confirmPresenceByToken(accessToken);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return bookingErrorResponse(err);
  }
}
