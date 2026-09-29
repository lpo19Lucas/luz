import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/slots";

/**
 * GET /api/salons/:salonSlug/slots?professionalId=&serviceId=&date=YYYY-MM-DD
 *
 * Horários livres pra um profissional/serviço num dia — usado pela tela
 * pública de agendamento (spec seção 8.4) pra montar a grade de horários.
 */
export async function GET(req: NextRequest) {
  const professionalId = req.nextUrl.searchParams.get("professionalId");
  const serviceId = req.nextUrl.searchParams.get("serviceId");
  const dateParam = req.nextUrl.searchParams.get("date");

  if (!professionalId || !serviceId || !dateParam) {
    return NextResponse.json(
      { error: "professionalId, serviceId e date são obrigatórios" },
      { status: 400 }
    );
  }

  const date = new Date(`${dateParam}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "date inválida" }, { status: 400 });
  }

  const slots = await getAvailableSlots(professionalId, serviceId, date);
  return NextResponse.json({ slots: slots.map((s) => s.toISOString()) });
}
