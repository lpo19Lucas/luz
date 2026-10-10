import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import ThemeRegistry from "./ThemeRegistry";
import PwaRegister from "./PwaRegister";
import { getAppUrl } from "@/lib/appUrl";

// Redesign Fase G: serifada nos títulos (Fraunces) + sans no corpo (Inter) —
// substitui o Roboto padrão do MUI em todo o app (dashboard e público).
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: {
    default: "DLJ Innovations — Agendamento online para negócios de serviços",
    template: "%s · DLJ Innovations",
  },
  description: "Plataforma de agendamento online para barbearias, salões, estúdios, clínicas, aulas e mais",
};

const INSTALL_PROMPT_CAPTURE = `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__luzInstallPrompt=e;window.dispatchEvent(new Event("luz:installprompt"));});window.addEventListener("appinstalled",function(){window.__luzInstallPrompt=null;window.dispatchEvent(new Event("luz:installprompt"));});`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${inter.variable}`}>
      <head>
        {/* PWA: o Chrome avisa que dá pra instalar (beforeinstallprompt) uma
            vez só, logo no carregamento — antes do React montar o botão (que
            no celular fica num menu que nem existe até ser aberto). Guarda o
            aviso aqui pro InstallAppPrompt usar quando aparecer. */}
        <script dangerouslySetInnerHTML={{ __html: INSTALL_PROMPT_CAPTURE }} />
      </head>
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
        <PwaRegister />
      </body>
    </html>
  );
}
