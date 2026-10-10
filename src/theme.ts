import { createTheme } from "@mui/material/styles";
import { BRAND_COLORS as C } from "@/lib/brand";

const display = "var(--font-display), 'Fraunces', serif";

const shared = {
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: "var(--font-body), 'Inter', system-ui, sans-serif",
    h1: { fontFamily: display, fontWeight: 600 },
    h2: { fontFamily: display, fontWeight: 600 },
    h3: { fontFamily: display, fontWeight: 600 },
    h4: { fontFamily: display, fontWeight: 600 },
    h5: { fontFamily: display, fontWeight: 600 },
    h6: { fontFamily: display, fontWeight: 600 },
    button: { fontWeight: 700, textTransform: "none" as const },
  },
};

/**
 * Tema da PLATAFORMA (site, login, painel, admin): escuro com brilho azul, a
 * identidade da DLJ Innovations. Papéis das cores (mantidos do tema antigo
 * pra não reescrever as telas): primary = azul de "chrome" (barras laterais
 * e blocos), secondary = azul elétrico de destaque (botões e links).
 */
export const theme = createTheme({
  ...shared,
  palette: {
    mode: "dark",
    primary: { main: "#16346A", light: "#2A5199", dark: C.chrome, contrastText: C.text },
    secondary: { main: C.accent, light: C.accentSoft, dark: C.accentDeep, contrastText: "#04152E" },
    background: { default: C.night, paper: C.surface },
    text: { primary: C.text, secondary: C.textMuted },
    divider: C.line,
  },
  components: {
    // Na plataforma escura o "primary" é o azul de chrome (barras); o que é interativo usa o azul elétrico.
    MuiButton: { defaultProps: { color: "secondary" }, styleOverrides: { root: { borderRadius: 999, paddingLeft: 20, paddingRight: 20 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" }, outlined: { borderColor: C.line } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 999, fontWeight: 600 } } },
    MuiAppBar: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiCssBaseline: { styleOverrides: { a: { color: C.accentSoft } } },
    MuiTextField: { defaultProps: { color: "secondary" } },
    MuiCheckbox: { defaultProps: { color: "secondary" } },
    MuiRadio: { defaultProps: { color: "secondary" } },
    MuiSwitch: { defaultProps: { color: "secondary" } },
    MuiLink: { defaultProps: { color: "secondary" } },
    MuiCircularProgress: { defaultProps: { color: "secondary" } },
  },
});

/**
 * Tema CLARO das páginas públicas de cada negócio (/[slug] e gerenciar
 * agendamento): o cliente final vê o negócio, não a plataforma, e o dono
 * escolhe as cores (SalonThemeProvider sobrescreve primary/secondary).
 */
export const salonLightTheme = createTheme({
  ...shared,
  palette: {
    mode: "light",
    primary: { main: "#1B2A4A", light: "#2E4472", dark: "#121D33" },
    secondary: { main: "#D4AF37", light: "#E3C564", dark: "#B8942C", contrastText: "#1B2A4A" },
    background: { default: "#FAF7F2", paper: "#FFFFFF" },
    text: { primary: "#1B2A4A", secondary: "#7A8399" },
    divider: "#ECE3CC",
  },
  components: {
    MuiButton: { styleOverrides: { root: { borderRadius: 999, paddingLeft: 20, paddingRight: 20 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" }, outlined: { borderColor: "#ECE3CC" } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 999, fontWeight: 600 } } },
    MuiAppBar: { styleOverrides: { root: { backgroundImage: "none" } } },
  },
});
