import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAppointment } from "@/lib/booking";
import { bookingErrorResponse } from "@/lib/bookingErrors";
import { getCurrentSalon } from "@/lib/currentSalon";

/**
 * POST /api/owner/appointments
 *
 * Agendamento manual pelo dono (B3) — mesma regra de negócio do fluxo
 * público (`src/lib/booking.ts`), mas com `source: "OWNER"`: permite um
 * horário de encaixe livre fora da grade de `getAvailableSlots`, só checando
 * conflito. Protegido por sessão (`getCurrentSalon` redireciona pra /login
 * sem sessão válida).
 */
interface Body {
  professionalId: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  startAt: string;
  wantsToPayNow: boolean;
  asset?: { name?: string; size?: string; detail?: string };
}

export async function POST(req: NextRequest) {
  const salon = await getCurrentSalon();
  const body = (await req.json()) as Body;

  try {
    const { appointment } = await createAppointment({
      salonSlug: salon.slug,
      professionalId: body.professionalId,
      serviceId: body.serviceId,
      clientName: body.clientName,
      clientPhone: body.clientPhone,
      startAt: new Date(body.startAt),
      wantsToPayNow: body.wantsToPayNow,
      source: "OWNER",
      actor: "OWNER",
      asset: body.asset,
    });

    revalidatePath("/agenda");
    return NextResponse.json({ id: appointment.id, accessToken: appointment.accessToken }, { status: 201 });
  } catch (err) {
    return bookingErrorResponse(err);
  }
}
