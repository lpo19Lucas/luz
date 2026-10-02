// Página pública de agendamento self-service (spec seção 8.4) + perfil do
// salão (F3): capa, descrição, endereço, redes sociais e WhatsApp, com o
// tema aplicando as cores escolhidas pelo dono. F15: metadata/Open Graph e
// JSON-LD HairSalon pra SEO/AEO.
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Box, Typography, Stack, Button, Alert } from "@mui/material";
import { prisma } from "@/lib/prisma";
import { whatsappLink } from "@/lib/phone";
import { getSession } from "@/lib/auth";
import { getSubscriptionAccess } from "@/lib/subscriptionAccess";
import { absoluteUrl } from "@/lib/appUrl";
import SalonThemeProvider from "./SalonThemeProvider";
import BookingClient from "./BookingClient";

const WEEKDAY_SCHEMA = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ salonSlug: string }>;
}): Promise<Metadata> {
  const { salonSlug } = await params;
  const salon = await prisma.salon.findUnique({ where: { slug: salonSlug } });
  if (!salon || !salon.publishedAt) return {};

  const title = salon.name;
  const description =
    salon.description ?? `Agende seu horário no ${salon.name} — escolha profissional, serviço e horário.`;
  const coverUrl = salon.coverImageData
    ? absoluteUrl(`/api/salons/${salon.slug}/cover?v=${salon.coverImageUpdatedAt?.getTime() ?? 0}`)
    : undefined;

  return {
    title,
    description,
    alternates: { canonical: `/${salon.slug}` },
    openGraph: {
      title,
      description,
      url: `/${salon.slug}`,
      type: "website",
      images: coverUrl ? [{ url: coverUrl }] : undefined,
    },
  };
}

function formatAddress(salon: {
  addressStreet: string | null;
  addressNumber: string | null;
  addressNeighborhood: string | null;
  addressCity: string | null;
  addressState: string | null;
}) {
  const line1 = [salon.addressStreet, salon.addressNumber].filter(Boolean).join(", ");
  const line2 = [salon.addressNeighborhood, salon.addressCity && salon.addressState ? `${salon.addressCity}/${salon.addressState}` : salon.addressCity]
    .filter(Boolean)
    .join(" — ");
  return [line1, line2].filter(Boolean).join(" · ");
}

export default async function BookingPage({
  params,
}: {
  params: Promise<{ salonSlug: string }>;
}) {
  const { salonSlug } = await params;
  const salon = await prisma.salon.findUnique({
    where: { slug: salonSlug },
    include: { subscription: true },
  });
  if (!salon) notFound();

  // F12: link público só abre pra clientes depois de publicado. F6: some
  // depois da carência por falta de pagamento. O dono logado continua vendo
  // uma prévia (com aviso) mesmo bloqueado por qualquer um dos dois.
  const session = await getSession();
  const isOwnerPreview = session?.userId === salon.ownerId;
  const subscriptionBlocked = getSubscriptionAccess(salon.subscription) === "BLOCKED";
  const isBlocked = (!salon.publishedAt || subscriptionBlocked) && !isOwnerPreview;

  const address = formatAddress(salon);
  const hasSocial = salon.instagramUrl || salon.facebookUrl || salon.tiktokUrl || salon.websiteUrl;
  const coverUrl = salon.coverImageData
    ? `/api/salons/${salon.slug}/cover?v=${salon.coverImageUpdatedAt?.getTime() ?? 0}`
    : null;

  const jsonLd = salon.publishedAt ? await buildHairSalonJsonLd(salon) : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
    <SalonThemeProvider primaryColor={salon.primaryColor} accentColor={salon.accentColor}>
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
        {coverUrl && (
          <Box
            sx={{
              height: { xs: 140, sm: 200 },
              backgroundImage: `url(${coverUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        )}

        {(salon.description || address || salon.whatsappPhone || hasSocial) && (
          <Box sx={{ maxWidth: 480, mx: "auto", px: 2.5, pt: 2 }}>
            {salon.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {salon.description}
              </Typography>
            )}
            {address && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                {address}
              </Typography>
            )}
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              {salon.whatsappPhone && (
                <Button
                  href={whatsappLink(salon.whatsappPhone)}
                  target="_blank"
                  rel="noreferrer"
                  size="small"
                  variant="outlined"
                  color="success"
                >
                  WhatsApp
                </Button>
              )}
              {salon.instagramUrl && (
                <Button href={salon.instagramUrl} target="_blank" rel="noreferrer" size="small">
                  Instagram
                </Button>
              )}
              {salon.facebookUrl && (
                <Button href={salon.facebookUrl} target="_blank" rel="noreferrer" size="small">
                  Facebook
                </Button>
              )}
              {salon.tiktokUrl && (
                <Button href={salon.tiktokUrl} target="_blank" rel="noreferrer" size="small">
                  TikTok
                </Button>
              )}
              {salon.websiteUrl && (
                <Button href={salon.websiteUrl} target="_blank" rel="noreferrer" size="small">
                  Site
                </Button>
              )}
            </Stack>
          </Box>
        )}

        {(!salon.publishedAt || subscriptionBlocked) && isOwnerPreview && (
          <Box sx={{ maxWidth: 480, mx: "auto", px: 2.5, pt: 2 }}>
            <Alert severity="warning">
              Prévia: só você (logado) está vendo essa página — clientes veem &ldquo;agenda
              indisponível&rdquo;.{" "}
              {!salon.publishedAt ? (
                <>
                  Publique em{" "}
                  <Link href="/inicio" style={{ color: "inherit" }}>
                    Primeiros passos
                  </Link>
                  .
                </>
              ) : (
                <>
                  Resolva o pagamento em{" "}
                  <Link href="/assinatura" style={{ color: "inherit" }}>
                    Assinatura
                  </Link>
                  .
                </>
              )}
            </Alert>
          </Box>
        )}

        {isBlocked ? (
          <Box sx={{ maxWidth: 480, mx: "auto", px: 2.5, pt: 4, textAlign: "center" }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Agenda temporariamente indisponível
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Esse salão ainda está configurando a agenda online. Tente de novo mais tarde.
            </Typography>
          </Box>
        ) : (
          <BookingClient salonSlug={salonSlug} />
        )}
      </Box>
      </SalonThemeProvider>
    </>
  );
}

type SalonWithExtras = NonNullable<Awaited<ReturnType<typeof prisma.salon.findUnique>>>;

/** JSON-LD HairSalon (F15) — endereço, horários (união das disponibilidades
 * de todos os profissionais), serviços oferecidos e redes sociais. */
async function buildHairSalonJsonLd(salon: SalonWithExtras) {
  const [services, availabilities] = await Promise.all([
    prisma.service.findMany({ where: { salonId: salon.id } }),
    prisma.availability.findMany({ where: { professional: { salonId: salon.id, active: true } } }),
  ]);

  const byWeekday = new Map<number, { start: string; end: string }>();
  for (const a of availabilities) {
    const current = byWeekday.get(a.weekday);
    if (!current || a.startTime < current.start) {
      byWeekday.set(a.weekday, { start: a.startTime, end: current?.end ?? a.endTime });
    }
    const entry = byWeekday.get(a.weekday)!;
    if (a.endTime > entry.end) entry.end = a.endTime;
  }

  const openingHoursSpecification = [...byWeekday.entries()].map(([weekday, { start, end }]) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: WEEKDAY_SCHEMA[weekday],
    opens: start,
    closes: end,
  }));

  const sameAs = [salon.instagramUrl, salon.facebookUrl, salon.tiktokUrl, salon.websiteUrl].filter(
    (url): url is string => Boolean(url)
  );

  const faq = Array.isArray(salon.faqJson)
    ? (salon.faqJson as Array<{ q?: string; a?: string }>).filter((f) => f.q && f.a)
    : [];

  return {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    name: salon.name,
    url: absoluteUrl(`/${salon.slug}`),
    ...(salon.description ? { description: salon.description } : {}),
    ...(salon.coverImageData
      ? { image: absoluteUrl(`/api/salons/${salon.slug}/cover?v=${salon.coverImageUpdatedAt?.getTime() ?? 0}`) }
      : {}),
    ...(salon.addressStreet
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: [salon.addressStreet, salon.addressNumber].filter(Boolean).join(", "),
            addressLocality: salon.addressCity ?? undefined,
            addressRegion: salon.addressState ?? undefined,
            postalCode: salon.addressZip ?? undefined,
            addressCountry: "BR",
          },
        }
      : {}),
    ...(salon.whatsappPhone ? { telephone: salon.whatsappPhone } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(openingHoursSpecification.length > 0 ? { openingHoursSpecification } : {}),
    ...(services.length > 0
      ? {
          makesOffer: services.map((s) => ({
            "@type": "Offer",
            itemOffered: { "@type": "Service", name: s.name },
            price: (s.priceCents / 100).toFixed(2),
            priceCurrency: "BRL",
          })),
        }
      : {}),
    ...(faq.length > 0
      ? {
          mainEntity: {
            "@type": "FAQPage",
            mainEntity: faq.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
        }
      : {}),
  };
}
