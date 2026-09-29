"use client";

/**
 * Conveniência pro cliente final no navegador dele: lembrar nome/telefone
 * pra não redigitar, e guardar os links dos agendamentos que ele já fez
 * nesse salão (o "cache" pedido). Isso é só UX local — nunca é a fonte de
 * verdade (o accessToken na URL continua sendo a autenticação de verdade) e
 * nunca é lido por nós; some se o cliente limpar os dados do navegador.
 */

type ClientInfo = { name: string; phone: string };

function keyInfo(salonSlug: string) {
  return `barbearia:${salonSlug}:clientInfo`;
}
function keyAppointments(salonSlug: string) {
  return `barbearia:${salonSlug}:appointments`;
}

export function getSavedClientInfo(salonSlug: string): ClientInfo | null {
  try {
    const raw = localStorage.getItem(keyInfo(salonSlug));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveClientInfo(salonSlug: string, info: ClientInfo) {
  try {
    localStorage.setItem(keyInfo(salonSlug), JSON.stringify(info));
  } catch {
    // Storage indisponível (aba anônima, cota cheia etc) — não é crítico, ignora.
  }
}

export function getSavedAppointmentTokens(salonSlug: string): string[] {
  try {
    const raw = localStorage.getItem(keyAppointments(salonSlug));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addSavedAppointmentToken(salonSlug: string, accessToken: string) {
  try {
    const current = getSavedAppointmentTokens(salonSlug);
    if (!current.includes(accessToken)) {
      localStorage.setItem(keyAppointments(salonSlug), JSON.stringify([accessToken, ...current].slice(0, 20)));
    }
  } catch {
    // idem — conveniência, não crítico.
  }
}
