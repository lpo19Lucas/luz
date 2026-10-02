import { NextRequest, NextResponse } from "next/server";
import { submitReviewByToken, ReviewError } from "@/lib/reviews";

const STATUS_AND_MESSAGE: Record<ReviewError["code"], [number, string]> = {
  NOT_FOUND: [404, "Agendamento não encontrado"],
  NOT_COMPLETED: [409, "Só é possível avaliar depois que o atendimento for concluído"],
  ALREADY_REVIEWED: [409, "Esse atendimento já foi avaliado"],
  INVALID_RATING: [400, "Nota inválida"],
};

/**
 * POST /api/appointments/:accessToken/review
 *
 * Avaliação pós-atendimento (nota + comentário) pelo mesmo link único que o
 * cliente já usa pra gerenciar o agendamento — não depende do WhatsApp real.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ accessToken: string }> }) {
  const { accessToken } = await params;
  const body = await req.json().catch(() => null);
  const rating = Number(body?.rating);
  const comment = typeof body?.comment === "string" ? body.comment : undefined;

  try {
    await submitReviewByToken({ accessToken, rating, comment });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ReviewError) {
      const [status, message] = STATUS_AND_MESSAGE[err.code];
      return NextResponse.json({ error: message }, { status });
    }
    console.error(err);
    return NextResponse.json({ error: "Erro inesperado" }, { status: 500 });
  }
}
