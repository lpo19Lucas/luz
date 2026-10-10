import { getSegment } from "@/lib/segments";

/**
 * Modo discreto (segmentos de saúde e podologia): o simples fato de alguém ter
 * horário marcado já é dado sensível (LGPD, art. 11). Nesse modo, nenhum aviso
 * que sai da plataforma (push, WhatsApp, evento de agenda) cita o serviço nem
 * o profissional — só "seu horário", o dia, a hora e o nome do negócio. A
 * pessoa ainda vê os detalhes ao abrir o link dela, que é protegido pelo token.
 * Também some tudo que expõe cliente publicamente (avaliações).
 */
export function isDiscreetSalon(salon: { segment?: string | null }): boolean {
  return getSegment(salon.segment).features.discreet;
}

/** "seu Corte" no modo normal, "seu horário" no discreto. */
export function yourAppointment(discreet: boolean, serviceName: string): string {
  return discreet ? "seu horário" : `seu ${serviceName}`;
}
