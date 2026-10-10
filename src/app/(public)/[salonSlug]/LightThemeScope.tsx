"use client";

import { ThemeProvider } from "@mui/material/styles";
import { Box } from "@mui/material";
import { salonLightTheme } from "@/theme";

/** Páginas públicas do negócio ficam no tema claro, independente do tema escuro da plataforma. */
export default function LightThemeScope({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={salonLightTheme}>
      <Box sx={{ bgcolor: "background.default", color: "text.primary", minHeight: "100vh" }}>{children}</Box>
    </ThemeProvider>
  );
}
