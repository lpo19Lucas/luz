import { isDiscreetSalon } from "@/lib/discreet";
import { whatsappLink } from "@/lib/phone";
import { manageAppointmentUrl } from "@/lib/calendarLinks";
import { formatSalonDate, formatSalonTime } from "@/lib/timezone";

/**
 * "Lembrar pelo WhatsApp" (Fase E5): pro cliente sem notificação push (ex.:
 * iPhone sem o app instalado), o dono abre o WhatsApp com a mensagem pronta
 * e só toca em enviar — envio manual, sem provedor e sem custo.
 */
export function whatsappReminderText(params: {
  clientName: string;
  salonName: string;
  serviceName: string;
  professionalName: string;
  startAt: Date;
  manageUrl: string;
  askConfirmation: boolean;
  /** Modo discreto: sem serviço nem profissional na mensagem. */
  discreet?: boolean;
}) {
  const firstName = params.clientName.trim().split(/\s+/)[0] ?? params.clientName;
  const when = `${formatSalonDate(params.startAt, { weekday: "long", day: "2-digit", month: "2-digit" })} às ${formatSalonTime(params.startAt)}`;
  const action = params.askConfirmation
    ? `Pode confirmar sua presença por aqui? ${params.manageUrl}`
    : `Se precisar remarcar ou cancelar: ${params.manageUrl}`;
  return `Olá, ${firstName}! Passando para lembrar ${params.discreet ? "do seu horário" : `do seu ${params.serviceName} com ${params.professionalName}`} no ${params.salonName}, ${when}. ${action}`;
}

export function whatsappReminderLink(appt: {
  accessToken: string;
  status: string;
  startAt: Date;
  client: { name: string; phone: string };
  service: { name: string };
  professionalName: string;
  salon: { name: string; slug: string; segment?: string | null };
}) {
  return whatsappLink(
    appt.client.phone,
    whatsappReminderText({
      clientName: appt.client.name,
      salonName: appt.salon.name,
      serviceName: appt.service.name,
      professionalName: appt.professionalName,
      startAt: appt.startAt,
      manageUrl: manageAppointmentUrl(appt.salon.slug, appt.accessToken),
      askConfirmation: appt.status === "AWAITING_CONFIRMATION",
      discreet: isDiscreetSalon(appt.salon),
    })
  );
}
