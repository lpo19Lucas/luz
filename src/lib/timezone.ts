// A plataforma assume que o salão sempre opera no horário de Brasília
// (mercado-alvo). O Brasil não observa horário de verão desde 2019, então um
// offset fixo (UTC-3) é seguro. Necessário porque funções serverless da
// Vercel sempre rodam com o processo em UTC e `TZ` é uma env var reservada
// lá — não dá pra configurar o timezone do processo como se fazia no
// docker-compose local (ver README, bug de timezone conhecido).

const SALON_UTC_OFFSET_MS = 3 * 60 * 60_000;

/**
 * Meia-noite (00:00) do dia do salão, como instante UTC. Só usa os
 * componentes Y/M/D de `dateOnly` (via getters UTC) — a hora do dia contida
 * nele é ignorada, então funciona tanto para um Date construído a partir de
 * `YYYY-MM-DDT00:00:00` quanto de `YYYY-MM-DDT00:00:00Z`.
 */
export function salonMidnightUTC(dateOnly: Date) {
  return new Date(
    Date.UTC(dateOnly.getUTCFullYear(), dateOnly.getUTCMonth(), dateOnly.getUTCDate()) +
      SALON_UTC_OFFSET_MS
  );
}

/** Fim do dia do salão (23:59:59.999 de Brasília), como instante UTC. */
export function salonEndOfDayUTC(dateOnly: Date) {
  return new Date(salonMidnightUTC(dateOnly).getTime() + 24 * 60 * 60_000 - 1);
}

/** Dia da semana (0 = domingo ... 6 = sábado) no horário de Brasília. */
export function salonWeekday(dateOnly: Date) {
  return salonMidnightUTC(dateOnly).getUTCDay();
}

/** Converte um horário "HH:mm" de parede do salão (Brasília) num instante UTC. */
export function salonWallClockToUTC(dateOnly: Date, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(salonMidnightUTC(dateOnly).getTime() + h * 60 * 60_000 + m * 60_000);
}

/**
 * Formata uma data/hora pro fuso do salão (Brasília) — usar em vez de
 * `toLocaleDateString`/`toLocaleTimeString` sem `timeZone` em Server
 * Components, já que o processo roda em UTC na Vercel (ver nota no topo
 * deste arquivo).
 */
export function formatSalonDate(date: Date, options: Intl.DateTimeFormatOptions = {}) {
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", ...options });
}

export function formatSalonTime(date: Date, options: Intl.DateTimeFormatOptions = {}) {
  return date.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
}
