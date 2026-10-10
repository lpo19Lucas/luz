"use client";

import { ThemeProvider, createTheme } from "@mui/material/styles";
import { salonLightTheme as baseTheme } from "@/theme";

/** Tema da página pública (F3) com as cores do salão, caindo pra paleta
 * padrão quando o dono não configurou nada. ThemeProvider aninhado — o MUI
 * mescla com o tema global do ThemeRegistry. */
export default function SalonThemeProvider({
  primaryColor,
  accentColor,
  children,
}: {
  primaryColor: string | null;
  accentColor: string | null;
  children: React.ReactNode;
}) {
  const theme = createTheme(baseTheme, {
    palette: {
      ...(primaryColor ? { primary: { main: primaryColor } } : {}),
      ...(accentColor ? { secondary: { main: accentColor } } : {}),
    },
  });

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
