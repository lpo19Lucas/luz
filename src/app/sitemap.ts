import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { getAppUrl } from "@/lib/appUrl";
import { getSubscriptionAccess } from "@/lib/subscriptionAccess";

/** F15: landing + salões publicados e não bloqueados (F6) — um salão
 * bloqueado por falta de pagamento sai do sitemap, já que o link está
 * indisponível pra cliente nesse estado. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = getAppUrl();

  const salons = await prisma.salon.findMany({
    where: { publishedAt: { not: null } },
    include: { subscription: true },
  });

  const salonEntries = salons
    .filter((s) => getSubscriptionAccess(s.subscription) !== "BLOCKED")
    .map((s) => ({
      url: `${appUrl}/${s.slug}`,
      lastModified: s.publishedAt ?? undefined,
    }));

  return [{ url: appUrl, changeFrequency: "monthly" as const, priority: 1 }, ...salonEntries];
}
