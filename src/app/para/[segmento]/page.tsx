// Multissegmento (S2): página de venda de cada nicho (/para/manicure,
// /para/personal-trainer...). O conteúdo (dores, exemplos, FAQ) vem de
// src/lib/segments.ts. Só os segmentos `available` têm página — os demais
// (saúde e os que dependem de ficha extra) dão 404 e ficam fora do sitemap.
import { Box, Typography, Stack, Button, Chip, Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTrialDays } from "@/lib/plans";
import { absoluteUrl } from "@/lib/appUrl";
import { availableSegments, getSegment, isSegmentSlug } from "@/lib/segments";
import LegalFooterLinks from "../../LegalFooterLinks";

export const revalidate = 300;

export function generateStaticParams() {
  return availableSegments().map((seg) => ({ segmento: seg.slug }));
}

function resolve(slug: string) {
  if (!isSegmentSlug(slug)) return null;
  const seg = getSegment(slug);
  return seg.available ? seg : null;
}

export async function generateMetadata({ params }: { params: Promise<{ segmento: string }> }): Promise<Metadata> {
  const { segmento } = await params;
  const seg = resolve(segmento);
  if (!seg) return {};
  return {
    title: seg.landing.title,
    description: seg.landing.subheadline,
    alternates: { canonical: absoluteUrl(`/para/${seg.slug}`) },
  };
}

export default async function SegmentLandingPage({ params }: { params: Promise<{ segmento: string }> }) {
  const { segmento } = await params;
  const seg = resolve(segmento);
  if (!seg) notFound();

  const trialDays = await getTrialDays();
  const { landing } = seg;
  const signupHref = `/cadastro?segmento=${seg.slug}`;
  const others = availableSegments().filter((o) => o.slug !== seg.slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: `Luz — ${landing.title}`,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: absoluteUrl(`/para/${seg.slug}`),
        description: landing.subheadline,
      },
      {
        "@type": "FAQPage",
        mainEntity: landing.faq.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };

  return (
    <Box sx={{ bgcolor: "background.default", overflowX: "hidden", minHeight: "100vh" }}>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: { xs: 2.5, md: 6 },
          py: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography component={Link} href="/" sx={{ fontWeight: 700, fontSize: 17, color: "text.primary", textDecoration: "none" }}>
          Luz
        </Typography>
        <Button component={Link} href={signupHref} variant="contained" size="small">
          Criar grátis
        </Button>
      </Box>

      <Box sx={{ px: { xs: 2.5, md: 6 }, py: { xs: 7, md: 10 }, textAlign: "center" }}>
        <Box sx={{ maxWidth: 720, mx: "auto" }}>
          <Typography sx={{ fontSize: 44, mb: 1 }} aria-hidden>
            {seg.emoji}
          </Typography>
          <Typography component="h1" sx={{ fontSize: { xs: 30, md: 42 }, fontWeight: 700, lineHeight: 1.15, mb: 2 }}>
            {landing.headline}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: { xs: 16, md: 18 }, mb: 3.5 }}>
            {landing.subheadline}
          </Typography>
          <Button component={Link} href={signupHref} variant="contained" size="large">
            Testar {trialDays} dias grátis
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Sem cartão de crédito. Seus {seg.vocab.clients} não precisam instalar nada.
          </Typography>
        </Box>
      </Box>

      <Box sx={{ px: { xs: 2.5, md: 6 }, pb: 8 }}>
        <Box
          sx={{
            maxWidth: 960,
            mx: "auto",
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            gap: 2,
          }}
        >
          {landing.pains.map((pain) => (
            <Box key={pain.title} sx={{ bgcolor: "#fff", border: "1px solid", borderColor: "divider", borderRadius: 4, p: 3 }}>
              <Typography sx={{ fontSize: 28, mb: 1 }} aria-hidden>
                {pain.icon}
              </Typography>
              <Typography sx={{ fontWeight: 600, mb: 0.75 }}>{pain.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {pain.body}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ px: { xs: 2.5, md: 6 }, pb: 8, textAlign: "center" }}>
        <Typography component="h2" variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
          O que {seg.vocab.clients} podem agendar
        </Typography>
        <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1} justifyContent="center" sx={{ maxWidth: 720, mx: "auto" }}>
          {landing.examples.map((example) => (
            <Chip key={example} label={example} />
          ))}
        </Stack>
      </Box>

      <Box sx={{ px: { xs: 2.5, md: 6 }, pb: 8 }}>
        <Box sx={{ maxWidth: 720, mx: "auto" }}>
          <Typography component="h2" variant="h5" sx={{ fontWeight: 600, mb: 2, textAlign: "center" }}>
            Dúvidas
          </Typography>
          {landing.faq.map((item) => (
            <Accordion key={item.q} disableGutters elevation={0} sx={{ border: "1px solid", borderColor: "divider", mb: 1, borderRadius: 2, "&:before": { display: "none" } }}>
              <AccordionSummary>
                <Typography sx={{ fontWeight: 600 }}>{item.q}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography color="text.secondary">{item.a}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Box>

      <Box sx={{ px: { xs: 2.5, md: 6 }, pb: 8, textAlign: "center" }}>
        <Button component={Link} href={signupHref} variant="contained" size="large">
          Criar minha agenda grátis
        </Button>
      </Box>

      <Box sx={{ px: { xs: 2.5, md: 6 }, py: 4, borderTop: "1px solid", borderColor: "divider", textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          A Luz também atende:
        </Typography>
        <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1.5} justifyContent="center" sx={{ mb: 3 }}>
          {others.map((o) => (
            <Box key={o.slug} component={Link} href={`/para/${o.slug}`} sx={{ fontSize: 13.5, color: "text.secondary" }}>
              {o.label}
            </Box>
          ))}
        </Stack>
        <LegalFooterLinks />
      </Box>
    </Box>
  );
}
