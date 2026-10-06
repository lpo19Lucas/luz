import { prisma } from "@/lib/prisma";
import { calendarLinksFor } from "@/lib/calendarLinks";

/** Carrega o agendamento com o que os links de agenda precisam e monta os links. */
export async function getCalendarLinksForAppointment(appointmentId: string) {
  const appointment = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
    include: {
      service: { select: { name: true } },
      professional: { select: { name: true } },
      salon: {
        select: {
          name: true,
          slug: true,
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
  return calendarLinksFor(appointment);
}
