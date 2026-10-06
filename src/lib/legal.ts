/**
 * Dados jurídicos da Luz usados nos Termos de Uso, Política de Privacidade
 * (LGPD) e Contrato de Licença (/termos, /privacidade, /contrato).
 *
 * Vêm de env vars pra dar pra preencher o CNPJ/razão social sem mexer no
 * código quando a empresa estiver aberta. Sem a env var, aparece um
 * marcador "[A DEFINIR]" no texto — visível de propósito, pra não publicar
 * um documento com dado inventado.
 *
 * ⚠️ Os textos são uma BASE. Antes de operar comercialmente, revise com um
 * advogado (principalmente foro, limitação de responsabilidade e LGPD).
 */

// Muda quando o texto dos documentos mudar de forma relevante — o aceite fica
// gravado com a versão (User.termsVersion), então dá pra saber quem aceitou
// qual versão e pedir novo aceite no futuro.
export const LEGAL_VERSION = "2026-10-06";
export const LEGAL_VERSION_LABEL = "6 de outubro de 2026";

const PLACEHOLDER = "[A DEFINIR]";

function env(name: string) {
  return process.env[name]?.trim() || null;
}

export function getLegalEntity() {
  return {
    brand: "Luz",
    companyName: env("LEGAL_COMPANY_NAME") ?? PLACEHOLDER,
    cnpj: env("LEGAL_CNPJ") ?? PLACEHOLDER,
    address: env("LEGAL_ADDRESS") ?? PLACEHOLDER,
    contactEmail: env("LEGAL_CONTACT_EMAIL") ?? PLACEHOLDER,
    // Encarregado pelo tratamento de dados pessoais (art. 41 da LGPD).
    dpoName: env("LEGAL_DPO_NAME") ?? PLACEHOLDER,
    dpoEmail: env("LEGAL_DPO_EMAIL") ?? env("LEGAL_CONTACT_EMAIL") ?? PLACEHOLDER,
    forumCity: env("LEGAL_FORUM_CITY") ?? PLACEHOLDER,
  };
}

/** true quando todos os dados da empresa já foram preenchidos. */
export function isLegalEntityConfigured() {
  return !Object.values(getLegalEntity()).includes(PLACEHOLDER);
}

export type LegalSection = { title: string; paragraphs: string[] };
