// F14: landing page da Luz — hoje a rota "/" não tinha nenhuma página de
// venda, só o dashboard e o link público de cada salão.
// Fase G: mesmo tratamento visual do redesign (nav com blur, cards com
// ícone/hover, plano em destaque, FAQ em cards) aplicado aqui também.
import { Box, Typography, Stack, Button, Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import Link from "next/link";
import type { Metadata } from "next";
import { PLANS } from "@/lib/plans";
import { whatsappLink } from "@/lib/phone";
import { absoluteUrl } from "@/lib/appUrl";

export const metadata: Metadata = {
  title: { absolute: "Luz — Agendamento online para salões e barbearias" },
  description:
    "A Luz é a plataforma de agendamento para salões e barbearias: link público pra cliente marcar sozinho, agenda com confirmação de presença, bloqueios, histórico, métricas e muito mais. 50 dias grátis.",
};

const PAINS = [
  {
    icon: "📵",
    title: "Cliente liga, você está ocupado, perde o horário",
    body: "Com o link público, o cliente agenda sozinho a qualquer hora — sem depender de alguém atender o telefone.",
  },
  {
    icon: "👻",
    title: "Cliente marca e não aparece",
    body: "Confirmação de presença automática antes do horário, com liberação do horário pra outro cliente se ele não confirmar.",
  },
  {
    icon: "📒",
    title: "Agenda de papel ou planilha não escala",
    body: "Um painel só pra isso: agenda por profissional, bloqueios de feriado/folga, histórico de cancelados e métricas de faturamento.",
  },
];

const STEPS = [
  { title: "Cadastre seu salão", body: "Nome, serviços e profissionais com horário — leva poucos minutos." },
  { title: "Publique seu link", body: "Um link só seu (luz.app/seu-salao) pra compartilhar no Instagram, WhatsApp, onde quiser." },
  { title: "Receba agendamentos", body: "Cliente escolhe profissional, serviço e horário livre — sem mensagem de ida e volta." },
];

const FEATURES = [
  "Link público de agendamento, sem app pro cliente instalar",
  "Agenda por profissional, com bloqueios de feriado e folga",
  "Confirmação de presença automática, com liberação de horário",
  "Agendamento manual pelo dono (telefone, balcão)",
  "Histórico de clientes, faturamento e no-show",
  "Métricas de faturamento por profissional e por período",
];

const FAQ = [
  {
    q: "Preciso instalar alguma coisa?",
    a: "Não. É tudo pelo navegador, tanto pra você quanto pro seu cliente — o link de agendamento abre numa página, sem app.",
  },
  {
    q: "Como funciona o teste grátis?",
    a: "50 dias grátis desde o cadastro, com tudo liberado. Depois disso você escolhe um dos planos pra continuar.",
  },
  {
    q: "Dá pra cancelar quando quiser?",
    a: "Sim, não tem fidelidade. A cobrança é manual via PIX, sem cartão salvo nem renovação automática forçada.",
  },
  {
    q: "Funciona pra salão de beleza ou só barbearia?",
    a: "O MVP nasceu pensando em barbearias, mas o cadastro de serviços e profissionais é livre — funciona pra qualquer negócio de agendamento por horário.",
  },
];

function formatPrice(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Luz",
        url: absoluteUrl("/"),
      },
      {
        "@type": "SoftwareApplication",
        name: "Luz",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        offers: PLANS.map((plan) => ({
          "@type": "Offer",
          name: plan.label,
          price: plan.pricePerMonth.toFixed(2),
          priceCurrency: "BRL",
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };
}

export default function LandingPage() {
  const salesPhone = process.env.NEXT_PUBLIC_SALES_WHATSAPP;

  return (
    <Box sx={{ bgcolor: "background.default", overflowX: "hidden" }}>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd()) }}
      />

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
            L
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: 17 }}>Luz</Typography>
        </Box>
        <Stack direction="row" spacing={3.5} sx={{ display: { xs: "none", sm: "flex" }, fontSize: 14 }}>
          <Box component="a" href="#planos" sx={{ color: "text.secondary", textDecoration: "none" }}>
            Planos
          </Box>
          <Box component="a" href="#duvidas" sx={{ color: "text.secondary", textDecoration: "none" }}>
            Dúvidas
          </Box>
          <Box component={Link} href="/login" sx={{ color: "text.secondary", textDecoration: "none" }}>
            Entrar
          </Box>
        </Stack>
        <Button
          component={Link}
          href="/cadastro"
          variant="contained"
          size="small"
          sx={{ bgcolor: "primary.main", color: "secondary.main", "&:hover": { bgcolor: "primary.dark" } }}
        >
          Criar grátis
        </Button>
      </Box>

      {/* Hero */}
      <Box sx={{ position: "relative", overflow: "hidden", px: { xs: 2.5, md: 6 }, py: { xs: 7, md: 10 } }}>
        <Box
          sx={{
            position: "absolute",
            width: 380,
            height: 380,
            borderRadius: "50%",
            bgcolor: "secondary.main",
            opacity: 0.16,
            filter: "blur(70px)",
            top: -140,
            left: "50%",
            transform: "translateX(-50%)",
            pointerEvents: "none",
          }}
        />
        <Box sx={{ maxWidth: 720, mx: "auto", textAlign: "center", position: "relative" }}>
          <Typography
            component="h1"
            sx={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: { xs: 36, sm: 44, md: 52 },
              lineHeight: 1.1,
              letterSpacing: "-0.5px",
              mb: 2.5,
            }}
          >
            Sua agenda, <Box component="span" sx={{ color: "secondary.dark" }}>sempre aberta</Box>
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 18, lineHeight: 1.6, mb: 4.5, maxWidth: 560, mx: "auto" }}>
            A Luz é a plataforma de agendamento online pro seu salão ou barbearia. Cliente marca
            sozinho, você gerencia tudo num painel só.
          </Typography>
          <Stack direction="row" spacing={1.75} justifyContent="center" sx={{ flexWrap: "wrap", gap: 1.75 }}>
            <Button
              component={Link}
              href="/cadastro"
              variant="contained"
              size="large"
              sx={{ bgcolor: "secondary.main", color: "primary.main", py: 1.75, px: 3.5, fontSize: 15 }}
            >
              Criar meu salão grátis
            </Button>
            {salesPhone && (
              <Button
                href={whatsappLink(salesPhone, "Olá! Quero saber mais sobre a Luz.")}
                target="_blank"
                rel="noreferrer"
                variant="outlined"
                size="large"
                sx={{ borderWidth: 1.5, py: 1.75, px: 3.5, fontSize: 15, borderColor: "primary.main" }}
              >
                Falar no WhatsApp
              </Button>
            )}
          </Stack>
        </Box>
      </Box>

      {/* Dores */}
      <Box sx={{ maxWidth: 1180, mx: "auto", px: { xs: 2.5, md: 6 }, pb: { xs: 7, md: 9 } }}>
        <Typography
          component="h2"
          sx={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: { xs: 26, md: 30 }, textAlign: "center", mb: 4 }}
        >
          Problemas que todo salão conhece
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2.5 }}>
          {PAINS.map((p) => (
            <Box
              key={p.title}
              sx={{
                bgcolor: "#fff",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 4,
                p: 3,
                transition: "transform .15s ease, box-shadow .15s ease",
                "&:hover": { transform: "translateY(-4px)", boxShadow: "0 16px 32px rgba(27,42,74,.1)" },
              }}
            >
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2.5,
                  bgcolor: "#FAF1D8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  mb: 2,
                }}
              >
                {p.icon}
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: 15.5, mb: 1 }}>{p.title}</Typography>
              <Typography sx={{ fontSize: 13.5, color: "text.secondary", lineHeight: 1.55 }}>{p.body}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Como funciona */}
      <Box sx={{ bgcolor: "primary.main", py: { xs: 7, md: 9 } }}>
        <Box sx={{ maxWidth: 1180, mx: "auto", px: { xs: 2.5, md: 6 } }}>
          <Typography
            component="h2"
            sx={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: { xs: 26, md: 30 }, color: "#FAF7F2", textAlign: "center", mb: 4.5 }}
          >
            Como funciona
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2.5 }}>
            {STEPS.map((s, i) => (
              <Box
                key={s.title}
                sx={{
                  bgcolor: "rgba(255,255,255,.06)",
                  border: "1px solid rgba(255,255,255,.1)",
                  borderRadius: 4,
                  p: 3,
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    bgcolor: "secondary.main",
                    color: "primary.main",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 15,
                    mb: 2,
                  }}
                >
                  {i + 1}
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: 15.5, color: "#FAF7F2", mb: 1 }}>{s.title}</Typography>
                <Typography sx={{ fontSize: 13.5, color: "#C3CAE0", lineHeight: 1.55 }}>{s.body}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Features */}
      <Box sx={{ maxWidth: 1180, mx: "auto", px: { xs: 2.5, md: 6 }, py: { xs: 7, md: 9 } }}>
        <Typography
          component="h2"
          sx={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: { xs: 26, md: 30 }, textAlign: "center", mb: 4 }}
        >
          Tudo que seu salão precisa
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
          {FEATURES.map((f) => (
            <Box
              key={f}
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 1.5,
                bgcolor: "#fff",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 3,
                p: 2,
              }}
            >
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  bgcolor: "#EAF4EC",
                  color: "#2F7D4F",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0,
                  mt: 0.1,
                }}
              >
                ✓
              </Box>
              <Typography sx={{ fontSize: 13.75, lineHeight: 1.5 }}>{f}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Planos */}
      <Box id="planos" sx={{ bgcolor: "#fff", borderTop: "1px solid", borderBottom: "1px solid", borderColor: "divider", py: { xs: 7, md: 9 } }}>
        <Box sx={{ maxWidth: 1180, mx: "auto", px: { xs: 2.5, md: 6 } }}>
          <Typography
            component="h2"
            sx={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: { xs: 26, md: 30 }, textAlign: "center", mb: 1 }}
          >
            Planos
          </Typography>
          <Typography sx={{ fontSize: 14, color: "text.secondary", textAlign: "center", mb: 5 }}>
            50 dias grátis pra testar tudo, sem cartão de crédito.
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
              gap: 2.5,
              maxWidth: 880,
              mx: "auto",
            }}
          >
            {PLANS.map((plan) => {
              const highlighted = plan.value === "YEARLY";
              return (
                <Box
                  key={plan.value}
                  sx={{
                    position: "relative",
                    bgcolor: highlighted ? "primary.main" : "background.default",
                    border: "2px solid",
                    borderColor: highlighted ? "secondary.main" : "divider",
                    borderRadius: 4,
                    p: 3.5,
                    textAlign: "center",
                  }}
                >
                  {highlighted && (
                    <Typography
                      sx={{
                        position: "absolute",
                        top: -13,
                        left: "50%",
                        transform: "translateX(-50%)",
                        bgcolor: "secondary.main",
                        color: "primary.main",
                        fontSize: 11,
                        fontWeight: 700,
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 999,
                      }}
                    >
                      MAIS ECONÔMICO
                    </Typography>
                  )}
                  <Typography
                    variant="overline"
                    sx={{ color: highlighted ? "#C3CAE0" : "text.secondary", letterSpacing: 1 }}
                  >
                    {plan.label}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 700,
                      fontSize: 30,
                      color: highlighted ? "#FAF7F2" : "primary.main",
                      my: 0.5,
                    }}
                  >
                    {formatPrice(plan.pricePerMonth)}
                    <Typography component="span" sx={{ fontSize: 13, color: highlighted ? "#C3CAE0" : "text.secondary" }}>
                      /mês
                    </Typography>
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: highlighted ? "#C3CAE0" : "text.secondary", display: "block", mb: 2.5 }}>
                    {plan.sub}
                  </Typography>
                  <Button
                    component={Link}
                    href="/cadastro"
                    fullWidth
                    variant={highlighted ? "contained" : "outlined"}
                    sx={
                      highlighted
                        ? { bgcolor: "secondary.main", color: "primary.main", "&:hover": { bgcolor: "secondary.dark" } }
                        : { borderColor: "primary.main" }
                    }
                  >
                    Começar grátis
                  </Button>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {/* FAQ */}
      <Box id="duvidas" sx={{ maxWidth: 760, mx: "auto", px: 2.5, py: { xs: 7, md: 9 } }}>
        <Typography
          component="h2"
          sx={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: { xs: 26, md: 30 }, textAlign: "center", mb: 4 }}
        >
          Perguntas frequentes
        </Typography>
        <Stack spacing={1.5}>
          {FAQ.map((item) => (
            <Accordion
              key={item.q}
              disableGutters
              elevation={0}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "16px !important",
                "&:before": { display: "none" },
                overflow: "hidden",
              }}
            >
              <AccordionSummary expandIcon={<Box sx={{ color: "secondary.dark", fontWeight: 700 }}>▾</Box>}>
                <Typography sx={{ fontWeight: 700, fontSize: 14.5 }}>{item.q}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography sx={{ fontSize: 13.75, color: "text.secondary", lineHeight: 1.6 }}>{item.a}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      </Box>

      {/* CTA final */}
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          bgcolor: "primary.main",
          py: { xs: 7, md: 8 },
          textAlign: "center",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            width: 320,
            height: 320,
            borderRadius: "50%",
            bgcolor: "secondary.main",
            opacity: 0.18,
            filter: "blur(70px)",
            top: -120,
            right: -60,
            pointerEvents: "none",
          }}
        />
        <Typography
          component="h2"
          sx={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: { xs: 26, md: 30 }, color: "#FAF7F2", mb: 3, position: "relative" }}
        >
          Pronto pra abrir sua agenda online?
        </Typography>
        <Button
          component={Link}
          href="/cadastro"
          variant="contained"
          size="large"
          sx={{ bgcolor: "secondary.main", color: "primary.main", py: 1.75, px: 4, fontSize: 15, position: "relative" }}
        >
          Criar meu salão grátis
        </Button>
      </Box>
    </Box>
  );
}
