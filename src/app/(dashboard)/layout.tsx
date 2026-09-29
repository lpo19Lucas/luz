import { AppBar, Toolbar, Typography, Box, Button } from "@mui/material";
import Link from "next/link";
import { getCurrentSalon } from "@/lib/currentSalon";
import { logoutAction } from "@/lib/actions/auth";

const NAV_ITEMS = [
  { href: "/agenda", label: "Agenda" },
  { href: "/profissionais", label: "Profissionais" },
  { href: "/servicos", label: "Serviços" },
  { href: "/metricas", label: "Métricas" },
  { href: "/assinatura", label: "Assinatura" },
  { href: "/configuracoes", label: "Configurações" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const salon = await getCurrentSalon();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="static" elevation={0}>
        <Toolbar sx={{ gap: 3, flexWrap: "wrap" }}>
          <Typography variant="h6" sx={{ fontWeight: 500 }}>
            {salon.name}
          </Typography>
          <Box sx={{ display: "flex", gap: 2.5, flexGrow: 1 }}>
            {NAV_ITEMS.map((item) => (
              <Typography
                key={item.href}
                component={Link}
                href={item.href}
                sx={{ color: "inherit", textDecoration: "none", fontSize: 14 }}
              >
                {item.label}
              </Typography>
            ))}
          </Box>
          <Typography
            component={Link}
            href={`/${salon.slug}`}
            sx={{ color: "secondary.main", textDecoration: "none", fontSize: 13 }}
          >
            Ver site público ↗
          </Typography>
          <Box component="form" action={logoutAction}>
            <Button type="submit" size="small" sx={{ color: "inherit" }}>
              Sair
            </Button>
          </Box>
        </Toolbar>
      </AppBar>
      <Box sx={{ p: 3, maxWidth: 1100, mx: "auto" }}>{children}</Box>
    </Box>
  );
}
