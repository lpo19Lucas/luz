/**
 * "Adicionar à agenda" pro cliente final (sem login): link do Google Agenda
 * já preenchido e arquivo .ics (iPhone, Outlook, qualquer agenda). Não é
 * integração com a conta Google — não precisa de OAuth nem aprovação do
 * Google. Limitação: o evento na agenda do cliente não se atualiza sozinho
 * se ele remarcar/cancelar; por isso a descrição leva o link de gerenciar e
 * o .ics usa UID fixo + SEQUENCE (= nº de remarcações), o que faz Apple
 * Calendar/Outlook substituírem o evento antigo ao abrir o arquivo novo.
 */
import { absoluteUrl } from "@/lib/appUrl";
import { isDiscreetSalon } from "@/lib/discreet";
import { formatSalonAddress, type SalonAddress } from "@/lib/salonAddress";

export type CalendarEvent = {
  uid: string;
  title: string;
  description: string;
  location: string;
  startAt: Date;
  endAt: Date;
  sequence: number;
  cancelled: boolean;
  url: string;
};

type AppointmentForCalendar = {
  id: string;
  accessToken: string;
  status: string;
  startAt: Date;
  endAt: Date;
  rescheduledCount: number;
  service: { name: string };
  professional: { name: string };
  salon: SalonAddress & { name: string; slug: string; whatsappPhone: string | null; segment?: string | null };
};

export function manageAppointmentUrl(salonSlug: string, accessToken: string) {
  return absoluteUrl(`/${salonSlug}/agendamento/${accessToken}`);
}

export function appointmentCalendarEvent(appt: AppointmentForCalendar): CalendarEvent {
  const url = manageAppointmentUrl(appt.salon.slug, appt.accessToken);
  const address = formatSalonAddress(appt.salon);
  // Modo discreto: o evento fica na agenda do celular — sem serviço nem profissional.
  const discreet = isDiscreetSalon(appt.salon);
  const lines = [
    discreet ? `Horário em ${appt.salon.name}.` : `${appt.service.name} com ${appt.professional.name} — ${appt.salon.name}.`,
    "",
    `Para confirmar presença, remarcar ou cancelar: ${url}`,
  ];
  if (appt.salon.whatsappPhone) lines.push(`WhatsApp do salão: ${appt.salon.whatsappPhone}`);
  return {
    uid: `${appt.id}@luz-agendamento`,
    title: discreet ? `Horário — ${appt.salon.name}` : `${appt.service.name} — ${appt.salon.name}`,
    description: lines.join("\n"),
    location: address ? `${appt.salon.name}, ${address}` : appt.salon.name,
    startAt: appt.startAt,
    endAt: appt.endAt,
    sequence: appt.rescheduledCount,
    cancelled: appt.status === "CANCELLED",
    url,
  };
}

/** 2026-10-06T15:00:00.000Z → 20261006T150000Z */
function toIcsUtc(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function googleCalendarUrl(ev: CalendarEvent) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${toIcsUtc(ev.startAt)}/${toIcsUtc(ev.endAt)}`,
    details: ev.description,
    location: ev.location,
    ctz: "America/Sao_Paulo",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Escapa texto conforme RFC 5545 (barra, ponto e vírgula, vírgula, quebra de linha). */
export function escapeIcsText(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/**
 * Dobra linhas em 75 octetos (RFC 5545 §3.1) sem quebrar um caractere UTF-8
 * no meio — nomes com acento são a regra aqui, não a exceção.
 */
export function foldIcsLine(line: string) {
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char, "utf8");
    const limit = parts.length === 0 ? 75 : 74; // continuação começa com espaço
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildIcs(ev: CalendarEvent, now: Date = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DLJ Innovations//Agendamento//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `SEQUENCE:${ev.sequence}`,
    `DTSTAMP:${toIcsUtc(now)}`,
    `DTSTART:${toIcsUtc(ev.startAt)}`,
    `DTEND:${toIcsUtc(ev.endAt)}`,
    `SUMMARY:${escapeIcsText(ev.title)}`,
    `DESCRIPTION:${escapeIcsText(ev.description)}`,
    `LOCATION:${escapeIcsText(ev.location)}`,
    `URL:${ev.url}`,
    `STATUS:${ev.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    // Lembrete 2h antes no próprio celular do cliente — reforça a
    // confirmação de presença sem depender de notificação nossa.
    ...(ev.cancelled
      ? []
      : ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeIcsText(ev.title)}`, "TRIGGER:-PT2H", "END:VALARM"]),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

/** Links prontos pra tela — null quando não faz sentido adicionar (cancelado, concluído, passado). */
export function calendarLinksFor(appt: AppointmentForCalendar, now: Date = new Date()) {
  const active = appt.status === "CONFIRMED" || appt.status === "AWAITING_CONFIRMATION";
  if (!active || appt.endAt <= now) return null;
  return {
    googleUrl: googleCalendarUrl(appointmentCalendarEvent(appt)),
    icsUrl: `/api/appointments/${appt.accessToken}/ics`,
  };
}
