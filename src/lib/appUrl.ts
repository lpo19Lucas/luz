/**
 * URL pública da aplicação — usada em links enviados por WhatsApp, metadata
 * de SEO (canonical/Open Graph), sitemap e JSON-LD.
 *
 * Ordem: APP_URL (domínio próprio, quando houver) → domínio de produção da
 * Vercel (variável de sistema) → localhost.
 */
export function getAppUrl() {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) return `https://${vercelProd}`;
  return "http://localhost:3000";
}

export function absoluteUrl(path: string) {
  return `${getAppUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
