import { createTheme } from "@mui/material/styles";

// Paleta "Classic Navy & Gold" escolhida na sessão de design (ver
// mui-paletas.html na raiz do projeto).
export const theme = createTheme({
  palette: {
    primary: { main: "#1E2761" },
    secondary: { main: "#C9A227" },
    background: { default: "#F4F5FA" },
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: '"Roboto","Helvetica Neue",Arial,sans-serif',
  },
});
