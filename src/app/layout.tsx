import type { Metadata } from "next";
import ThemeRegistry from "./ThemeRegistry";
import { getAppUrl } from "@/lib/appUrl";

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
    <html lang="pt-BR">
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}
