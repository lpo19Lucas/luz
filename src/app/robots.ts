import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/appUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/agenda", "/profissionais", "/servicos", "/bloqueios", "/historico", "/clientes", "/metricas", "/assinatura", "/configuracoes", "/ajuda", "/inicio", "/admin", "/login", "/cadastro", "/api"],
    },
    sitemap: `${getAppUrl()}/sitemap.xml`,
  };
}
