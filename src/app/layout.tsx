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
    default: "Luz — Agendamento online para salões e barbearias",
    template: "%s · Luz",
  },
  description: "Plataforma de agendamento para salões e barbearias",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
        <PwaRegister />
      </body>
    </html>
  );
}
