// Página pública de agendamento self-service (spec seção 8.4) + perfil do
// salão (F3): capa, descrição, endereço, redes sociais e WhatsApp, com o
// tema aplicando as cores escolhidas pelo dono.
import { notFound } from "next/navigation";
import Link from "next/link";
import { Box, Typography, Stack, Button, Alert } from "@mui/material";
import { prisma } from "@/lib/prisma";
import { whatsappLink } from "@/lib/phone";
import { getSession } from "@/lib/auth";
import { getSubscriptionAccess } from "@/lib/subscriptionAccess";
import SalonThemeProvider from "./SalonThemeProvider";
import BookingClient from "./BookingClient";

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

  return (
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
  );
}
