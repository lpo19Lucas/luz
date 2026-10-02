import { Typography, Box, Button, Stack, Divider, Alert } from "@mui/material";
import Link from "next/link";
import { getCurrentSalon } from "@/lib/currentSalon";
import { logoutAction } from "@/lib/actions/auth";
import { whatsappLink } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { getSubscriptionAccess } from "@/lib/subscriptionAccess";

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
  { href: "/ajuda", label: "Ajuda" },
];

const SIDEBAR_WIDTH = 220;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const salon = await getCurrentSalon();
  const supportPhone = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
  const subscription = await prisma.subscription.findUnique({ where: { salonId: salon.id } });
  const access = getSubscriptionAccess(subscription);

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
          {supportPhone && (
            <Typography
              component="a"
              href={whatsappLink(supportPhone, "Olá! Preciso de ajuda com a Luz.")}
              target="_blank"
              rel="noreferrer"
              sx={{
                display: "block",
                color: "inherit",
                textDecoration: "none",
                fontSize: 13,
                px: 1,
                py: 1,
              }}
            >
              Falar com o suporte
            </Typography>
          )}
          <Box component="form" action={logoutAction}>
            <Button type="submit" size="small" fullWidth sx={{ color: "inherit", justifyContent: "flex-start", px: 1 }}>
              Sair
            </Button>
          </Box>
        </Box>
      </Box>

      <Box sx={{ flexGrow: 1, p: 3, maxWidth: 1100 }}>
        {access === "GRACE" && (
          <Alert severity="warning" sx={{ mb: 2 }} action={<Button component={Link} href="/assinatura" color="inherit" size="small">Resolver</Button>}>
            Pagamento pendente — resolva antes do fim da carência pra não perder o link público.
          </Alert>
        )}
        {access === "BLOCKED" && (
          <Alert severity="error" sx={{ mb: 2 }} action={<Button component={Link} href="/assinatura" color="inherit" size="small">Resolver</Button>}>
            Link público indisponível por falta de pagamento. Os agendamentos já marcados continuam
            válidos.
          </Alert>
        )}
        {children}
      </Box>
    </Box>
  );
}
