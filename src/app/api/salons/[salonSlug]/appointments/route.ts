import { NextRequest, NextResponse } from "next/server";
import { createAppointment } from "@/lib/booking";
import { bookingErrorResponse } from "@/lib/bookingErrors";
import { getCalendarLinksForAppointment } from "@/lib/appointmentCalendar";

/**
 * POST /api/salons/:salonSlug/appointments
 *
 * Cria um agendamento self-service do cliente (spec seção 8.4). A regra de
 * negócio (validação de profissional/serviço, conflito de horário, upsert de
 * cliente, cliente banido, jobs de WhatsApp e histórico) vive em
 * `src/lib/booking.ts` — essa rota só traduz request/response.
 */

interface CreateAppointmentBody {
  professionalId: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  startAt: string; // ISO string
  wantsToPayNow: boolean;
  usePackageId?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ salonSlug: string }> }
) {
  const { salonSlug } = await params;
  const body = (await req.json()) as CreateAppointmentBody;

  try {
    const { appointment } = await createAppointment({
      salonSlug,
      professionalId: body.professionalId,
      serviceId: body.serviceId,
      clientName: body.clientName,
      clientPhone: body.clientPhone,
      startAt: new Date(body.startAt),
      wantsToPayNow: body.wantsToPayNow,
      source: "ONLINE",
      actor: "CLIENT",
      usePackageId: body.usePackageId,
    });

    return NextResponse.json(
      {
        id: appointment.id,
        accessToken: appointment.accessToken,
        manageUrl: `/${salonSlug}/agendamento/${appointment.accessToken}`,
        // "Adicionar à agenda" na tela de sucesso (Google + .ics).
        calendar: await getCalendarLinksForAppointment(appointment.id),
      },
      { status: 201 }
    );
  } catch (err) {
    return bookingErrorResponse(err);
  }
}
