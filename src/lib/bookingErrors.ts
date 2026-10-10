import { NextResponse } from "next/server";
import { BookingError, BookingErrorCode } from "@/lib/booking";

const STATUS_AND_MESSAGE: Record<BookingErrorCode, [number, string]> = {
  SALON_NOT_FOUND: [404, "Salão não encontrado"],
  INVALID_SERVICE: [400, "Serviço inválido"],
  INVALID_PROFESSIONAL: [400, "Quem você escolheu não realiza esse serviço"],
  SLOT_TAKEN: [409, "Esse horário acabou de ser ocupado. Escolha outro."],
  SLOT_UNAVAILABLE: [409, "Esse horário não está mais disponível. Escolha outro."],
  CLIENT_BANNED: [403, "Não foi possível agendar. Entre em contato com o salão."],
  NOT_FOUND: [404, "Agendamento não encontrado"],
  ALREADY_CANCELLED: [409, "Agendamento já estava cancelado"],
  ALREADY_FINISHED: [409, "Esse horário já foi encerrado"],
  CANNOT_CONFIRM: [409, "Esse agendamento não pode mais ser confirmado"],
  CANNOT_RESCHEDULE: [409, "Esse agendamento não pode mais ser reagendado"],
  PAST_SLOT: [400, "Horário inválido ou no passado"],
  SALON_NOT_PUBLISHED: [409, "Agenda temporariamente indisponível"],
  SALON_BLOCKED: [409, "Agenda temporariamente indisponível"],
  PACKAGE_NOT_USABLE: [409, "Esse pacote não pode mais ser usado para esse agendamento"],
  ASSET_REQUIRED: [400, "Informe os dados do pet ou do veículo"],
};

/** Traduz um erro do fluxo de agendamento pra uma resposta HTTP — usado pelas rotas públicas. */
export function bookingErrorResponse(err: unknown) {
  if (err instanceof BookingError) {
    const [status, message] = STATUS_AND_MESSAGE[err.code];
    return NextResponse.json({ error: message }, { status });
  }
  console.error(err);
  return NextResponse.json({ error: "Erro inesperado" }, { status: 500 });
}
