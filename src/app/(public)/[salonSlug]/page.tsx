// Página pública de agendamento self-service (spec seção 8.4) + perfil do
// salão (F3): capa, descrição, endereço, redes sociais e WhatsApp, com o
// tema aplicando as cores escolhidas pelo dono. F15: metadata/Open Graph e
// JSON-LD HairSalon pra SEO/AEO.
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Box, Typography, Stack, Button, Alert, Paper, TextField } from "@mui/material";
import { prisma } from "@/lib/prisma";
import { whatsappLink } from "@/lib/phone";
import { getSession } from "@/lib/auth";
import { getSubscriptionAccess } from "@/lib/subscriptionAccess";
import { absoluteUrl } from "@/lib/appUrl";
import { storedImageUrl } from "@/lib/storedImages";
import { getPublicReviews } from "@/lib/reviews";
import { reservePackagePublicAction } from "@/lib/actions/package";
import SalonThemeProvider from "./SalonThemeProvider";
import BookingClient from "./BookingClient";
import ReviewsCarousel from "./ReviewsCarousel";
import LegalFooterLinks from "../../LegalFooterLinks";

const GALLERY_GRADIENTS = [
  "linear-gradient(160deg,#E8C9A0,#D4AF37)",
  "linear-gradient(160deg,#C9A0E8,#A0C9E8)",
  "linear-gradient(160deg,#1B2A4A,#44506E)",
  "linear-gradient(160deg,#E8A0A0,#E8C9A0)",
  "linear-gradient(160deg,#A0C9E8,#C9A0E8)",
  "linear-gradient(160deg,#D4AF37,#E8C9A0)",
];

const HOW_IT_WORKS = [
  { icon: "🔍", title: "Escolha o serviço", desc: "Veja preço e duração antes de marcar." },
  { icon: "👤", title: "Escolha o profissional", desc: "Ou deixe qualquer um disponível." },
  { icon: "🗓️", title: "Escolha o horário", desc: "Vagas reais, atualizadas na hora." },
  { icon: "✅", title: "Pronto!", desc: "Confirmação na hora, sem precisar ligar." },
];

/** Foto enviada pelo dono (stored_images) ou, no legado, a URL externa. */
function photoOf(p: { photoImageId: string | null; photoUrl: string | null }) {
  return storedImageUrl(p.photoImageId) ?? p.photoUrl;
}

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

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
    include: {
      subscription: true,
      professionals: { where: { active: true }, orderBy: { name: "asc" } },
      services: { orderBy: { name: "asc" } },
    },
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

  // Busca sempre (mesmo bloqueado) — é barato, e o JSON-LD precisa das
  // avaliações mesmo quando a agenda em si está indisponível pro cliente.
  const [packageDefinitions, publicReviews] = await Promise.all([
    prisma.packageDefinition.findMany({ where: { salonId: salon.id, active: true }, include: { service: true } }),
    getPublicReviews(salon.id),
  ]);

  const jsonLd = salon.publishedAt ? await buildHairSalonJsonLd(salon, publicReviews) : null;

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
      <Box sx={{ bgcolor: "background.default", overflowX: "hidden" }}>
        {/* Nav */}
        <Box
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: { xs: 2.5, md: 6 },
            py: 2,
            backdropFilter: "blur(10px)",
            bgcolor: "rgba(250,247,242,.85)",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "10px",
                bgcolor: "primary.main",
                color: "secondary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {salon.name.charAt(0).toUpperCase()}
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 17 }}>{salon.name}</Typography>
          </Box>
          <Stack direction="row" spacing={3.5} sx={{ display: { xs: "none", sm: "flex" }, fontSize: 14 }}>
            {salon.services.length > 0 && (
              <Box component="a" href="#servicos" sx={{ color: "text.secondary", textDecoration: "none" }}>
                Serviços
              </Box>
            )}
            {salon.professionals.length > 0 && (
              <Box component="a" href="#equipe" sx={{ color: "text.secondary", textDecoration: "none" }}>
                Equipe
              </Box>
            )}
            <Box component="a" href="#galeria" sx={{ color: "text.secondary", textDecoration: "none" }}>
              Galeria
            </Box>
            {publicReviews.total > 0 && (
              <Box component="a" href="#avaliacoes" sx={{ color: "text.secondary", textDecoration: "none" }}>
                Avaliações
              </Box>
            )}
          </Stack>
          {!isBlocked && (
            <Button
              component="a"
              href="#agendar"
              variant="contained"
              size="small"
              sx={{ bgcolor: "primary.main", color: "secondary.main", "&:hover": { bgcolor: "primary.dark" } }}
            >
              Agendar agora
            </Button>
          )}
        </Box>

        {/* Hero */}
        <Box sx={{ position: "relative", overflow: "hidden", px: { xs: 2.5, md: 6 }, py: { xs: 6, md: 9 } }}>
          <Box
            sx={{
              position: "absolute",
              width: 340,
              height: 340,
              borderRadius: "50%",
              bgcolor: "secondary.main",
              opacity: 0.18,
              filter: "blur(60px)",
              top: -120,
              right: -80,
              pointerEvents: "none",
            }}
          />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1.1fr 1fr" },
              gap: { xs: 5, md: 7 },
              alignItems: "center",
              maxWidth: 1180,
              mx: "auto",
              position: "relative",
            }}
          >
            <Box>
              {address && (
                <Typography
                  variant="caption"
                  sx={{
                    display: "inline-block",
                    bgcolor: "primary.main",
                    color: "secondary.main",
                    fontWeight: 700,
                    px: 1.75,
                    py: 0.75,
                    borderRadius: 999,
                    mb: 2.5,
                  }}
                >
                  📍 {address}
                </Typography>
              )}
              <Typography
                component="h1"
                sx={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: { xs: 36, sm: 44, md: 52 },
                  lineHeight: 1.08,
                  letterSpacing: "-0.5px",
                  mb: 2.5,
                }}
              >
                {salon.name}
              </Typography>
              {salon.description && (
                <Typography color="text.secondary" sx={{ fontSize: 17, lineHeight: 1.6, maxWidth: 460, mb: 4 }}>
                  {salon.description}
                </Typography>
              )}
              {!isBlocked && (
                <Stack direction="row" spacing={1.75} sx={{ flexWrap: "wrap", gap: 1.75, mb: 5 }}>
                  <Button
                    component="a"
                    href="#agendar"
                    variant="contained"
                    size="large"
                    sx={{ bgcolor: "secondary.main", color: "primary.main", py: 1.75, px: 3.5, fontSize: 15 }}
                  >
                    Ver horários disponíveis
                  </Button>
                  {salon.professionals.length > 0 && (
                    <Button
                      component="a"
                      href="#equipe"
                      variant="outlined"
                      size="large"
                      sx={{ borderWidth: 1.5, py: 1.75, px: 3.5, fontSize: 15, borderColor: "primary.main" }}
                    >
                      Conhecer a equipe
                    </Button>
                  )}
                </Stack>
              )}
              <Stack direction="row" spacing={4.5} sx={{ flexWrap: "wrap", rowGap: 2 }}>
                {publicReviews.total > 0 && publicReviews.averageRating && (
                  <Box>
                    <Typography sx={{ fontSize: 24, fontWeight: 700 }}>
                      {publicReviews.averageRating.toFixed(1)} ★
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {publicReviews.total} avaliaç{publicReviews.total === 1 ? "ão" : "ões"}
                    </Typography>
                  </Box>
                )}
                {salon.professionals.length > 0 && (
                  <Box>
                    <Typography sx={{ fontSize: 24, fontWeight: 700 }}>{salon.professionals.length}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      profission{salon.professionals.length === 1 ? "al" : "ais"}
                    </Typography>
                  </Box>
                )}
                {salon.services.length > 0 && (
                  <Box>
                    <Typography sx={{ fontSize: 24, fontWeight: 700 }}>{salon.services.length}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      serviç{salon.services.length === 1 ? "o" : "os"}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </Box>

            <Box sx={{ position: "relative" }}>
              <Box
                sx={{
                  width: "100%",
                  height: { xs: 260, md: 420 },
                  borderRadius: 7,
                  boxShadow: "0 30px 60px rgba(27,42,74,.18)",
                  ...(coverUrl
                    ? { backgroundImage: `url(${coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                    : {
                        background: "linear-gradient(135deg,#C9A0E8 0%,#E8C9A0 55%,#D4AF37 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "var(--font-display)",
                        fontSize: 64,
                        fontWeight: 700,
                        color: "rgba(27,42,74,.35)",
                      }),
                }}
              >
                {!coverUrl && salon.name.charAt(0).toUpperCase()}
              </Box>
              {!isBlocked && (
                <Box
                  sx={{
                    position: "absolute",
                    bottom: -20,
                    left: -16,
                    bgcolor: "#fff",
                    borderRadius: 4,
                    px: 2.25,
                    py: 1.75,
                    boxShadow: "0 18px 36px rgba(27,42,74,.2)",
                    display: "flex",
                    alignItems: "center",
                    gap: 1.25,
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      bgcolor: "primary.main",
                      color: "secondary.main",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                    }}
                  >
                    📅
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Agenda em tempo real</Typography>
                    <Typography sx={{ fontSize: 11, color: "text.secondary" }}>Marque sem precisar ligar</Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        </Box>

        {hasSocial && (
          <Box sx={{ maxWidth: 1180, mx: "auto", px: { xs: 2.5, md: 6 }, pb: 2 }}>
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
          <Box sx={{ maxWidth: 1180, mx: "auto", px: { xs: 2.5, md: 6 }, pb: 2 }}>
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
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
          <Box sx={{ maxWidth: 480, mx: "auto", px: 2.5, pt: 2, pb: 8, textAlign: "center" }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Agenda temporariamente indisponível
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Esse salão ainda está configurando a agenda online. Tente de novo mais tarde.
            </Typography>
          </Box>
        ) : (
          <>
            {/* Como funciona */}
            <Box sx={{ maxWidth: 1180, mx: "auto", px: { xs: 2.5, md: 6 }, pb: { xs: 6, md: 8 } }}>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
                  gap: 2,
                }}
              >
                {HOW_IT_WORKS.map((step) => (
                  <Box
                    key={step.title}
                    sx={{ bgcolor: "#fff", border: "1px solid", borderColor: "divider", borderRadius: 4, p: 2.75 }}
                  >
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2.5,
                        bgcolor: "#FAF1D8",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 19,
                        mb: 1.5,
                      }}
                    >
                      {step.icon}
                    </Box>
                    <Typography sx={{ fontSize: 14.5, fontWeight: 700, mb: 0.5 }}>{step.title}</Typography>
                    <Typography sx={{ fontSize: 13, color: "text.secondary", lineHeight: 1.5 }}>
                      {step.desc}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Serviços */}
            {salon.services.length > 0 && (
              <Box id="servicos" sx={{ maxWidth: 1180, mx: "auto", px: { xs: 2.5, md: 6 }, pb: { xs: 6, md: 9 } }}>
                <Box sx={{ textAlign: "center", maxWidth: 520, mx: "auto", mb: 4.5 }}>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 700, color: "secondary.dark", letterSpacing: 1.5 }}
                  >
                    NOSSOS SERVIÇOS
                  </Typography>
                  <Typography
                    component="h2"
                    sx={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: { xs: 26, md: 32 }, mt: 1 }}
                  >
                    O que fazemos por aqui
                  </Typography>
                </Box>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(4, 1fr)" },
                    gap: 2.5,
                  }}
                >
                  {salon.services.map((s) => (
                    <Box
                      component="a"
                      href="#agendar"
                      key={s.id}
                      sx={{
                        display: "block",
                        bgcolor: "#fff",
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 4,
                        overflow: "hidden",
                        textDecoration: "none",
                        color: "inherit",
                        transition: "transform .15s ease, box-shadow .15s ease",
                        "&:hover": { transform: "translateY(-4px)", boxShadow: "0 16px 32px rgba(27,42,74,.1)" },
                      }}
                    >
                      {s.imageId && (
                        <Box
                          component="img"
                          src={storedImageUrl(s.imageId)!}
                          alt={s.name}
                          loading="lazy"
                          sx={{ display: "block", width: "100%", aspectRatio: "4 / 3", objectFit: "cover" }}
                        />
                      )}
                      <Box sx={{ p: 3 }}>
                        <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 0.5 }}>{s.name}</Typography>
                        <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2 }}>
                          {s.durationMinutes} min
                        </Typography>
                        <Typography sx={{ fontSize: 18, fontWeight: 700, color: "primary.main" }}>
                          {formatPrice(s.priceCents)}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Equipe */}
            {salon.professionals.length > 0 && (
              <Box id="equipe" sx={{ bgcolor: "primary.main", py: { xs: 6, md: 8 } }}>
                <Box sx={{ maxWidth: 1180, mx: "auto", px: { xs: 2.5, md: 6 } }}>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 700, color: "secondary.main", letterSpacing: 1.5 }}
                  >
                    NOSSA EQUIPE
                  </Typography>
                  <Typography
                    component="h2"
                    sx={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                      fontSize: { xs: 24, md: 28 },
                      color: "#FAF7F2",
                      mt: 1,
                      mb: 3.5,
                    }}
                  >
                    Profissionais que você escolhe
                  </Typography>
                  <Stack direction="row" spacing={2.5} sx={{ overflowX: "auto", pb: 1 }}>
                    {salon.professionals.map((p) => (
                      <Box
                        key={p.id}
                        sx={{
                          flex: "0 0 180px",
                          bgcolor: "rgba(255,255,255,.06)",
                          border: "1px solid rgba(255,255,255,.1)",
                          borderRadius: 4,
                          p: 2.5,
                          textAlign: "center",
                        }}
                      >
                        <Box
                          sx={{
                            width: 88,
                            height: 88,
                            borderRadius: "50%",
                            bgcolor: "secondary.main",
                            color: "primary.main",
                            mx: "auto",
                            mb: 1.5,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily: "var(--font-display)",
                            fontWeight: 700,
                            fontSize: 20,
                            ...(photoOf(p)
                              ? { backgroundImage: `url(${photoOf(p)})`, backgroundSize: "cover", backgroundPosition: "center" }
                              : {}),
                          }}
                        >
                          {!photoOf(p) && p.name.charAt(0).toUpperCase()}
                        </Box>
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#FAF7F2" }}>{p.name}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              </Box>
            )}

            <Box id="agendar" sx={{ pt: { xs: 6, md: 8 } }}>
              <Box sx={{ maxWidth: 480, mx: "auto", px: 2.5, textAlign: "center", mb: 1 }}>
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 700, color: "secondary.dark", letterSpacing: 1.5 }}
                >
                  AGENDE SEU HORÁRIO
                </Typography>
              </Box>
              <BookingClient salonSlug={salonSlug} />
            </Box>

            {packageDefinitions.length > 0 && (
              <Box sx={{ maxWidth: 480, mx: "auto", px: 2.5, pb: 3 }}>
                <Typography variant="overline" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                  Pacotes
                </Typography>
                <Stack spacing={1.5}>
                  {packageDefinitions.map((def) => (
                    <Paper key={def.id} variant="outlined" sx={{ p: 1.5 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {def.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {def.type === "SERVICE_CREDITS"
                              ? `${def.credits} usos de ${def.service?.name ?? "serviço"}`
                              : `Crédito de ${formatPrice(def.valueCents ?? 0)}`}{" "}
                            · válido {def.validityDays} dias
                          </Typography>
                        </Box>
                        <Typography sx={{ fontWeight: 700, color: "primary.main" }}>
                          {formatPrice(def.priceCents)}
                        </Typography>
                      </Stack>
                      <Stack component="form" action={reservePackagePublicAction} direction="row" spacing={1}>
                        <input type="hidden" name="salonSlug" value={salonSlug} />
                        <input type="hidden" name="packageDefinitionId" value={def.id} />
                        <TextField name="clientName" label="Nome" size="small" required fullWidth />
                        <TextField name="clientPhone" label="Telefone" size="small" required fullWidth />
                        <Button type="submit" variant="outlined" sx={{ flexShrink: 0 }}>
                          Reservar
                        </Button>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                  A reserva fica pendente até o salão confirmar o pagamento.
                </Typography>
              </Box>
            )}

            {/* Galeria — sem feature de múltiplas fotos ainda (só a capa, F3);
                mosaico decorativo no lugar das fotos reais, com aviso só pro
                dono explicando o que falta. */}
            <Box id="galeria" sx={{ maxWidth: 1180, mx: "auto", px: { xs: 2.5, md: 6 }, pt: { xs: 7, md: 9 }, pb: { xs: 2, md: 3 } }}>
              <Box sx={{ textAlign: "center", mb: 4 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: "secondary.dark", letterSpacing: 1.5 }}>
                  GALERIA
                </Typography>
                <Typography
                  component="h2"
                  sx={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: { xs: 24, md: 28 }, mt: 1 }}
                >
                  Um gostinho do espaço
                </Typography>
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gridTemplateRows: "140px 140px",
                  gap: 2,
                }}
              >
                {GALLERY_GRADIENTS.map((gradient, i) => (
                  <Box
                    key={i}
                    sx={{
                      gridRow: i === 0 || i === 2 ? "span 2" : undefined,
                      borderRadius: 4,
                      background: gradient,
                    }}
                  />
                ))}
              </Box>
              {isOwnerPreview && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center", mt: 2 }}>
                  Só você (dono) vê este aviso: fotos reais do salão ainda não têm onde ser cadastradas — por
                  enquanto é um espaço decorativo.
                </Typography>
              )}
            </Box>

            {publicReviews.total > 0 && (
              <Box id="avaliacoes" sx={{ maxWidth: 760, mx: "auto", px: 2.5, pt: { xs: 7, md: 9 }, pb: { xs: 7, md: 9 } }}>
                <Box sx={{ textAlign: "center", mb: 4 }}>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 700, color: "secondary.dark", letterSpacing: 1.5 }}
                  >
                    DEPOIMENTOS
                  </Typography>
                  <Typography
                    component="h2"
                    sx={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: { xs: 24, md: 28 }, mt: 1 }}
                  >
                    Quem já marcou, recomenda
                  </Typography>
                </Box>
                <ReviewsCarousel reviews={publicReviews.reviews} />
              </Box>
            )}

            {/* Teaser do app PWA (Fase E) — ainda não existe de verdade, então o
                botão não promete nada: é só "em breve". */}
            <Box sx={{ maxWidth: 1180, mx: "auto", px: { xs: 2.5, md: 6 }, pt: { xs: 2, md: 3 }, pb: { xs: 7, md: 9 } }}>
              <Box
                sx={{
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: 7,
                  bgcolor: "primary.main",
                  backgroundImage: "linear-gradient(135deg,#1B2A4A,#2E4472)",
                  p: { xs: 4, md: 6 },
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 4,
                  flexWrap: "wrap",
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    width: 260,
                    height: 260,
                    borderRadius: "50%",
                    bgcolor: "secondary.main",
                    opacity: 0.2,
                    filter: "blur(60px)",
                    top: -80,
                    right: -60,
                    pointerEvents: "none",
                  }}
                />
                <Box sx={{ maxWidth: 440, position: "relative" }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: "secondary.main", letterSpacing: 1.5 }}>
                    EM BREVE
                  </Typography>
                  <Typography
                    component="h2"
                    sx={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: { xs: 22, md: 26 }, color: "#FAF7F2", mt: 1, mb: 1.5 }}
                  >
                    Instale e receba lembretes no celular
                  </Typography>
                  <Typography sx={{ fontSize: 13.5, color: "#C3CAE0", lineHeight: 1.6 }}>
                    Estamos preparando um app instalável pra avisar você sobre confirmação, lembrete de
                    horário e pedido de presença — sem precisar de WhatsApp.
                  </Typography>
                </Box>
                <Box
                  sx={{
                    bgcolor: "rgba(255,255,255,.08)",
                    border: "1px solid rgba(255,255,255,.15)",
                    borderRadius: 999,
                    px: 2.5,
                    py: 1.25,
                    color: "#C3CAE0",
                    fontSize: 13,
                    fontWeight: 700,
                    position: "relative",
                  }}
                >
                  🔔 Em breve
                </Box>
              </Box>
            </Box>

            <Box sx={{ px: 2.5, py: 3, textAlign: "center", borderTop: "1px solid", borderColor: "divider" }}>
              <Typography variant="caption" color="text.secondary">
                {salon.name} · agendamento online pela Luz
              </Typography>
              <Box sx={{ mt: 1 }}>
                <LegalFooterLinks />
              </Box>
            </Box>
          </>
        )}
      </Box>
      </SalonThemeProvider>
    </>
  );
}

type SalonWithExtras = NonNullable<Awaited<ReturnType<typeof prisma.salon.findUnique>>>;

/** JSON-LD HairSalon (F15) — endereço, horários (união das disponibilidades
 * de todos os profissionais), serviços oferecidos e redes sociais. */
async function buildHairSalonJsonLd(
  salon: SalonWithExtras,
  publicReviews: Awaited<ReturnType<typeof getPublicReviews>>
) {
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
    ...(publicReviews.total > 0 && publicReviews.averageRating !== null
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: publicReviews.averageRating.toFixed(1),
            reviewCount: publicReviews.total,
          },
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
