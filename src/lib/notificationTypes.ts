import type { NotificationType } from "@prisma/client";

/**
 * Tipos de aviso que a equipe pode ligar/desligar, com o rótulo da tela.
 * Arquivo sem dependência de servidor: é importado pelo formulário de
 * preferências (componente de navegador).
 */
export const STAFF_NOTIFICATION_TYPES: { type: NotificationType; label: string; ownerOnly?: boolean }[] = [
  { type: "BOOKING_CREATED", label: "Novo agendamento" },
  { type: "BOOKING_CANCELLED", label: "Cancelamento" },
  { type: "BOOKING_RESCHEDULED", label: "Remarcação" },
  { type: "PRESENCE_CONFIRMED", label: "Presença confirmada pelo cliente" },
  { type: "DAILY_AGENDA", label: "Resumo do dia às 7h" },
  { type: "PACKAGE_RESERVED", label: "Pacote reservado pelo cliente", ownerOnly: true },
  { type: "REVIEW_RECEIVED", label: "Avaliação nova", ownerOnly: true },
];
