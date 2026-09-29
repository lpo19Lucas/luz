import { Box, Typography, Button } from "@mui/material";
import Link from "next/link";

export default function NotFound() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        bgcolor: "background.default",
      }}
    >
      <Typography variant="h4" sx={{ fontWeight: 500 }}>
        Página não encontrada
      </Typography>
      <Button component={Link} href="/login" variant="contained">
        Ir para o login
      </Button>
    </Box>
  );
}
