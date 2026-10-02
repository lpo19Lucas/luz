import { createTheme } from "@mui/material/styles";

// Paleta "Navy & Gold" refinada (Fase G do roadmap — ver
// ../STATUS-DO-PROJETO.md). Navy escuro como base de texto/UI, dourado como
// destaque e CTA, fundo creme (não branco puro) pra dar mais aconchego do
// que o cinza MUI padrão. Cores por salão (SalonThemeProvider) continuam
// sobrescrevendo primary/secondary.
export const theme = createTheme({
  palette: {
    primary: { main: "#1B2A4A", light: "#2E4472", dark: "#121D33" },
    secondary: { main: "#D4AF37", light: "#E3C564", dark: "#B8942C", contrastText: "#1B2A4A" },
    background: { default: "#FAF7F2", paper: "#FFFFFF" },
    text: { primary: "#1B2A4A", secondary: "#7A8399" },
    divider: "#ECE3CC",
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: "var(--font-body), 'Inter', system-ui, sans-serif",
    h1: { fontFamily: "var(--font-display), 'Fraunces', serif", fontWeight: 600 },
    h2: { fontFamily: "var(--font-display), 'Fraunces', serif", fontWeight: 600 },
    h3: { fontFamily: "var(--font-display), 'Fraunces', serif", fontWeight: 600 },
    h4: { fontFamily: "var(--font-display), 'Fraunces', serif", fontWeight: 600 },
    h5: { fontFamily: "var(--font-display), 'Fraunces', serif", fontWeight: 600 },
    h6: { fontFamily: "var(--font-display), 'Fraunces', serif", fontWeight: 600 },
    button: { fontWeight: 700, textTransform: "none" },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 999, paddingLeft: 20, paddingRight: 20 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
        outlined: { borderColor: "#ECE3CC" },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 600 },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
  },
});
