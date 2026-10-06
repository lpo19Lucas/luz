/**
 * PWA (Fase E1): dois apps instaláveis sobre o mesmo site.
 *
 * - App do dono/profissional ("Luz"): abre na /agenda.
 * - App do estabelecimento (pro cliente): nome e cores do salão, abre na
 *   página pública dele e fica restrito a ela (scope /slug).
 *
 * Um service worker só (/sw.js, escopo "/") atende os dois — ver public/sw.js.
 */

export const LUZ_NAVY = "#1B2A4A";
export const LUZ_GOLD = "#D4AF37";
export const LUZ_CREAM = "#FAF7F2";

const HEX = /^#[0-9a-fA-F]{6}$/;

export type WebManifest = {
  id: string;
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: "standalone";
  background_color: string;
  theme_color: string;
  lang: string;
  icons: { src: string; sizes: string; type: string; purpose: "any" | "maskable" }[];
};

function icons(query: string) {
  return [192, 512].flatMap((size) => [
    { src: `/pwa-icon?${query}&size=${size}`, sizes: `${size}x${size}`, type: "image/png", purpose: "any" as const },
    { src: `/pwa-icon?${query}&size=${size}&maskable=1`, sizes: `${size}x${size}`, type: "image/png", purpose: "maskable" as const },
  ]);
}

/** Nome curto pra tela inicial (o sistema corta ~12 caracteres). */
export function shortName(name: string) {
  const trimmed = name.trim();
  if (trimmed.length <= 12) return trimmed;
  const firstWord = trimmed.split(/\s+/)[0];
  return firstWord.length <= 12 ? firstWord : trimmed.slice(0, 12);
}

export function buildOwnerManifest(): WebManifest {
  return {
    id: "/agenda",
    name: "Luz — Painel do salão",
    short_name: "Luz",
    description: "Agenda, clientes e notificações do seu estabelecimento.",
    start_url: "/agenda?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: LUZ_CREAM,
    theme_color: LUZ_NAVY,
    lang: "pt-BR",
    icons: icons("app=luz"),
  };
}

export function buildSalonManifest(salon: { name: string; slug: string; primaryColor: string | null }): WebManifest {
  const color = salon.primaryColor && HEX.test(salon.primaryColor) ? salon.primaryColor : LUZ_NAVY;
  return {
    id: `/${salon.slug}`,
    name: salon.name,
    short_name: shortName(salon.name),
    description: `Agende seu horário no ${salon.name}.`,
    start_url: `/${salon.slug}?source=pwa`,
    scope: `/${salon.slug}`,
    display: "standalone",
    background_color: LUZ_CREAM,
    theme_color: color,
    lang: "pt-BR",
    icons: icons(`salon=${encodeURIComponent(salon.slug)}`),
  };
}

/** Letra do ícone: primeira letra/dígito do nome, em maiúscula. */
export function iconInitial(name: string) {
  const match = name.normalize("NFD").replace(/[̀-ͯ]/g, "").match(/[A-Za-z0-9]/);
  return (match?.[0] ?? "L").toUpperCase();
}

export function iconColors(primaryColor: string | null | undefined, accentColor: string | null | undefined) {
  return {
    background: primaryColor && HEX.test(primaryColor) ? primaryColor : LUZ_NAVY,
    foreground: accentColor && HEX.test(accentColor) ? accentColor : LUZ_GOLD,
  };
}

/**
 * iPhone/iPad: o navegador não oferece "instalar" — o usuário precisa fazer
 * Compartilhar → Adicionar à Tela de Início, e só então o push funciona
 * (iOS 16.4+). iPadOS 13+ se identifica como Mac, por isso o teste de toque.
 */
export function isIos(userAgent: string, maxTouchPoints = 0) {
  return /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
}

/** Versão do iOS (major) ou null. Web Push só a partir da 16.4. */
export function iosVersion(userAgent: string): number | null {
  const match = userAgent.match(/OS (\d+)_(\d+)/);
  return match ? Number(match[1]) + Number(match[2]) / 100 : null;
}

export function iosSupportsWebPush(userAgent: string) {
  const version = iosVersion(userAgent);
  return version === null || version >= 16.04;
}

/** Chave VAPID (base64url) → bytes, formato que pushManager.subscribe exige. */
export function urlBase64ToUint8Array(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
