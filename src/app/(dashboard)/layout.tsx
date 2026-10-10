import { Button, Alert } from "@mui/material";
import Link from "next/link";
import { getCurrentSalon } from "@/lib/currentSalon";
import { logoutAction, acceptTermsAction } from "@/lib/actions/auth";
import { needsTermsAcceptance } from "@/lib/termsAcceptance";
import { whatsappLink } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { getSubscriptionAccess } from "@/lib/subscriptionAccess";
import { cap, getSegment } from "@/lib/segments";
import DashboardChrome from "./DashboardChrome";
import type { Metadata } from "next";

// PWA: o painel instala como o app "Luz" (abre na /agenda).
export const metadata: Metadata = {
  manifest: "/app.webmanifest",
  appleWebApp: { capable: true, title: "Luz", statusBarStyle: "black-translucent" },
  icons: { apple: "/pwa-icon?app=luz&size=192" },
};

/** O vocabulário do menu muda com o segmento (profissionais/alunos/pacientes...). */
function navItemsFor(segmentSlug: string) {
  const seg = getSegment(segmentSlug);
  return NAV_ITEMS.map((item) =>
    item.href === "/profissionais"
      ? { ...item, label: cap(seg.vocab.professionals), icon: seg.emoji }
      : item.href === "/clientes"
        ? { ...item, label: cap(seg.vocab.clients) }
        : item
  );
}

const NAV_ITEMS = [
  { href: "/inicio", label: "Início", icon: "🏠" },
  { href: "/agenda", label: "Agenda", icon: "🗓️" },
  { href: "/profissionais", label: "Profissionais", icon: "✂️" },
  { href: "/servicos", label: "Serviços", icon: "💅" },
  { href: "/bloqueios", label: "Bloqueios", icon: "🚫" },
  { href: "/historico", label: "Histórico", icon: "🕓" },
  { href: "/clientes", label: "Clientes", icon: "👥" },
  { href: "/pacotes", label: "Pacotes", icon: "🎁" },
  { href: "/avaliacoes", label: "Avaliações", icon: "⭐" },
  { href: "/comissoes", label: "Comissões", icon: "💰" },
  { href: "/metricas", label: "Métricas", icon: "📊" },
  { href: "/assinatura", label: "Assinatura", icon: "💳" },
  { href: "/configuracoes", label: "Configurações", icon: "⚙️" },
  { href: "/ajuda", label: "Ajuda", icon: "💬" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const salon = await getCurrentSalon();
  const supportPhone = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
  const subscription = await prisma.subscription.findUnique({ where: { salonId: salon.id } });
  const access = getSubscriptionAccess(subscription);
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: salon.ownerId }, select: { termsVersion: true } });

  const banners = (
    <>
      {needsTermsAcceptance(owner) && (
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
          Publicamos os <Link href="/termos" target="_blank">Termos de Uso</Link>, a{" "}
          <Link href="/privacidade" target="_blank">Política de Privacidade</Link> e o{" "}
          <Link href="/contrato" target="_blank">Contrato de Licença</Link> da Luz. Leia e confirme o aceite
          para continuar usando a plataforma.
        </Alert>
      )}
      {access === "GRACE" && (
        <Alert
          severity="warning"
          sx={{ mb: 2, borderRadius: 2 }}
          action={
            <Button component={Link} href="/assinatura" color="inherit" size="small">
              Resolver
            </Button>
          }
        >
          Pagamento pendente — resolva antes do fim da carência pra não perder o link público.
        </Alert>
      )}
      {access === "BLOCKED" && (
        <Alert
          severity="error"
          sx={{ mb: 2, borderRadius: 2 }}
          action={
            <Button component={Link} href="/assinatura" color="inherit" size="small">
              Resolver
            </Button>
          }
        >
          Link público indisponível por falta de pagamento. Os agendamentos já marcados continuam
          válidos.
        </Alert>
      )}
    </>
  );

  return (
    <DashboardChrome
      salonName={salon.name}
      salonSlug={salon.slug}
      supportPhone={supportPhone}
      supportHref={supportPhone ? whatsappLink(supportPhone, "Olá! Preciso de ajuda com a Luz.") : null}
      logoutAction={logoutAction}
      navItems={navItemsFor(salon.segment)}
      banners={banners}
    >
      {children}
    </DashboardChrome>
  );
}
