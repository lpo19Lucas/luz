// Metadados de PWA da área pública do salão (página + gerenciar
// agendamento): o cliente que instala leva o "app do estabelecimento".
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ salonSlug: string }> }): Promise<Metadata> {
  const { salonSlug } = await params;
  return {
    manifest: `/${salonSlug}/manifest.webmanifest`,
    appleWebApp: { capable: true, statusBarStyle: "default" },
    icons: { apple: `/pwa-icon?salon=${encodeURIComponent(salonSlug)}&size=192` },
  };
}

export default function SalonPublicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
