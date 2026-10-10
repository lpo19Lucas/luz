import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { appointmentCalendarEvent, buildIcs } from "@/lib/calendarLinks";

/**
 * GET /api/appointments/:accessToken/ics
 *
 * Arquivo .ics do agendamento ("Adicionar à agenda" do iPhone/Outlook/etc.).
 * O token na URL é a autenticação, como no resto das rotas do cliente.
 * Agendamento cancelado sai com STATUS:CANCELLED — abrir o arquivo de novo
 * remove o evento nas agendas que respeitam UID/SEQUENCE.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ accessToken: string }> }) {
  const { accessToken } = await params;
  const appointment = await prisma.appointment.findUnique({
    where: { accessToken },
    include: {
      service: { select: { name: true } },
      professional: { select: { name: true } },
      salon: {
        select: {
          name: true,
          slug: true,
          segment: true,
          whatsappPhone: true,
          addressStreet: true,
          addressNumber: true,
          addressNeighborhood: true,
          addressCity: true,
          addressState: true,
        },
      },
    },
  });
  if (!appointment) {
    return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
  }

  return new NextResponse(buildIcs(appointmentCalendarEvent(appointment)), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="agendamento.ics"',
      "Cache-Control": "no-store",
    },
  });
}
