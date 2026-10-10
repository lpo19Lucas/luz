/**
 * Identidade da plataforma: DLJ Innovations. Nome e cores num lugar só — o
 * restante do código lê daqui (ou do tema MUI em src/theme.ts) em vez de
 * repetir o texto. Logo oficial em /public/dlj-logo.jpg; emblema recortado em
 * /public/dlj-icon-*.png e src/app/icon.png.
 */
export const BRAND_NAME = "DLJ Innovations";
export const BRAND_SHORT = "DLJ";
export const BRAND_TAGLINE = "Agendamento online";

export const BRAND_COLORS = {
  /** Fundo do app (azul-noite) */
  night: "#0A1730",
  /** Cartões e superfícies */
  surface: "#102447",
  /** Barra lateral, rodapé e blocos de destaque */
  chrome: "#071126",
  /** Azul elétrico do brilho do logo — destaque, botões e links */
  accent: "#3AA6FF",
  accentSoft: "#7FC4FF",
  accentDeep: "#1F86E0",
  /** Prata do hexágono */
  silver: "#C9D2DF",
  text: "#E9EFFA",
  textMuted: "#93A4C4",
  line: "#1F3560",
} as const;

/** Azul-marinho do fundo da logo — fundo dos ícones do app. */
export const BRAND_ICON_BG = "#182945";
