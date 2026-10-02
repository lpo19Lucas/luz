import { Typography, Box, Button, Stack, Divider } from "@mui/material";
import Link from "next/link";
import { getCurrentSalon } from "@/lib/currentSalon";
import { logoutAction } from "@/lib/actions/auth";

const NAV_ITEMS = [
  { href: "/inicio", label: "Início" },
  { href: "/agenda", label: "Agenda" },
  { href: "/profissionais", label: "Profissionais" },
  { href: "/servicos", label: "Serviços" },
  { href: "/bloqueios", label: "Bloqueios" },
  { href: "/historico", label: "Histórico" },
  { href: "/clientes", label: "Clientes" },
  { href: "/metricas", label: "Métricas" },
  { href: "/assinatura", label: "Assinatura" },
  { href: "/configuracoes", label: "Configurações" },
];

const SIDEBAR_WIDTH = 220;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const salon = await getCurrentSalon();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", display: "flex" }}>
      <Box
        component="nav"
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          minHeight: "100vh",
          bgcolor: "primary.main",
          color: "primary.contrastText",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          alignSelf: "flex-start",
        }}
      >
        <Box sx={{ p: 2.5, pb: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 500, lineHeight: 1.2 }}>
            {salon.name}
          </Typography>
        </Box>

        <Stack component="ul" sx={{ listStyle: "none", m: 0, p: 0, flexGrow: 1 }}>
          {NAV_ITEMS.map((item) => (
            <Box component="li" key={item.href}>
              <Typography
                component={Link}
                href={item.href}
                sx={{
                  display: "block",
                  color: "inherit",
                  textDecoration: "none",
                  fontSize: 14,
                  px: 2.5,
                  py: 1.25,
                  "&:hover": { bgcolor: "rgba(255,255,255,0.08)" },
                }}
              >
                {item.label}
              </Typography>
            </Box>
          ))}
        </Stack>

        <Divider sx={{ borderColor: "rgba(255,255,255,0.15)" }} />
        <Box sx={{ p: 1.5 }}>
          <Typography
            component={Link}
            href={`/${salon.slug}`}
            sx={{
              display: "block",
              color: "secondary.main",
              textDecoration: "none",
              fontSize: 13,
              px: 1,
              py: 1,
            }}
          >
            Ver site público ↗
          </Typography>
          <Box component="form" action={logoutAction}>
            <Button type="submit" size="small" fullWidth sx={{ color: "inherit", justifyContent: "flex-start", px: 1 }}>
              Sair
            </Button>
          </Box>
        </Box>
      </Box>

      <Box sx={{ flexGrow: 1, p: 3, maxWidth: 1100 }}>{children}</Box>
    </Box>
  );
}
