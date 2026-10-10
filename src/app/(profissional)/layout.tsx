// Área do profissional com acesso próprio (Fase P): só a própria agenda e a
// própria conta. Usa getCurrentProfessional — o dono que cair aqui vai pra
// /agenda, e nenhuma tela do dono é alcançável a partir daqui.
import type { Metadata } from "next";
import { AppBar, Toolbar, Typography, Box, Button, Stack, Alert } from "@mui/material";
import Link from "next/link";
import { getCurrentProfessional } from "@/lib/currentSalon";
import { logoutAction, acceptTermsAction } from "@/lib/actions/auth";
import { prisma } from "@/lib/prisma";
import { needsTermsAcceptance } from "@/lib/termsAcceptance";

export const metadata: Metadata = {
  manifest: "/app.webmanifest",
  appleWebApp: { capable: true, title: "DLJ Innovations", statusBarStyle: "black-translucent" },
  icons: { apple: "/dlj-icon-192.png" },
  robots: { index: false },
};

export default async function ProfessionalLayout({ children }: { children: React.ReactNode }) {
  const member = await getCurrentProfessional();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: member.userId }, select: { termsVersion: true } });

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: "primary.main" }}>
        <Toolbar sx={{ gap: 1, flexWrap: "wrap", py: { xs: 1, sm: 0 } }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, color: "#FAF7F2", lineHeight: 1.2 }}>{member.professional.name}</Typography>
            <Typography variant="caption" sx={{ color: "#C3CAE0" }}>
              {member.salon.name}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5}>
            <Button component={Link} href="/minha-agenda" size="small" sx={{ color: "#FAF7F2" }}>
              Agenda
            </Button>
            <Button component={Link} href="/minha-conta" size="small" sx={{ color: "#FAF7F2" }}>
              Conta
            </Button>
            <Box component="form" action={logoutAction}>
              <Button type="submit" size="small" sx={{ color: "#C3CAE0" }}>
                Sair
              </Button>
            </Box>
          </Stack>
        </Toolbar>
      </AppBar>
      <Box sx={{ maxWidth: 720, mx: "auto", p: { xs: 2, md: 3 } }}>
        {needsTermsAcceptance(user) && (
          <Alert
            severity="info"
            sx={{ mb: 2, borderRadius: 2 }}
            action={
              <form action={acceptTermsAction}>
                <Button type="submit" color="inherit" size="small">
                  Li e aceito
                </Button>
              </form>
            }
          >
            Leia os <Link href="/termos" target="_blank">Termos de Uso</Link> e a{" "}
            <Link href="/privacidade" target="_blank">Política de Privacidade</Link> da DLJ Innovations e confirme o aceite.
          </Alert>
        )}
        {children}
      </Box>
    </Box>
  );
}
