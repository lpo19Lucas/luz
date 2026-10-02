/** Telefone só com dígitos — é assim que o cliente é identificado dentro do salão. */
export function normalizePhone(raw: string) {
  return raw.replace(/\D/g, "");
}

/** Telefone brasileiro "plausível": DDD + 8 ou 9 dígitos (com ou sem 55 na frente). */
export function isValidPhone(raw: string) {
  const digits = normalizePhone(raw);
  return digits.length >= 10 && digits.length <= 13;
}

/** Formata pra exibição: (11) 99999-9999. Devolve como veio se não reconhecer. */
export function formatPhone(raw: string) {
  const d = normalizePhone(raw).replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}

/** Link wa.me (com 55 na frente quando faltar) e, opcionalmente, texto pré-preenchido. */
export function whatsappLink(raw: string, text?: string) {
  let d = normalizePhone(raw);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${d}${query}`;
}
