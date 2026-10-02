import { Button, Alert } from "@mui/material";
import Link from "next/link";
import { getCurrentSalon } from "@/lib/currentSalon";
import { logoutAction } from "@/lib/actions/auth";
import { whatsappLink } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { getSubscriptionAccess } from "@/lib/subscriptionAccess";
import DashboardChrome from "./DashboardChrome";

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

  const banners = (
    <>
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
      navItems={NAV_ITEMS}
      banners={banners}
    >
      {children}
    </DashboardChrome>
  );
}
