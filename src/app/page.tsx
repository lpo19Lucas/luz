// F14: landing page da Luz — hoje a rota "/" não tinha nenhuma página de
// venda, só o dashboard e o link público de cada salão.
import { Box, Typography, Paper, Stack, Button, Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
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
    title: "Cliente liga, você está ocupado, perde o horário",
    body: "Com o link público, o cliente agenda sozinho a qualquer hora — sem depender de alguém atender o telefone.",
  },
  {
    title: "Cliente marca e não aparece",
    body: "Confirmação de presença automática antes do horário, com liberação do horário pra outro cliente se ele não confirmar.",
  },
  {
    title: "Agenda de papel ou planilha não escala",
    body: "Um painel só pra isso: agenda por profissional, bloqueios de feriado/folga, histórico de cancelados e métricas de faturamento.",
  },
];

const STEPS = [
  { title: "1. Cadastre seu salão", body: "Nome, serviços e profissionais com horário — leva poucos minutos." },
  { title: "2. Publique seu link", body: "Um link só seu (luz.app/seu-salao) pra compartilhar no Instagram, WhatsApp, onde quiser." },
  { title: "3. Receba agendamentos", body: "Cliente escolhe profissional, serviço e horário livre — sem mensagem de ida e volta." },
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
    <Box sx={{ bgcolor: "background.default" }}>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd()) }}
      />
      <Box sx={{ bgcolor: "primary.main", color: "primary.contrastText", py: { xs: 6, md: 9 } }}>
        <Box sx={{ maxWidth: 720, mx: "auto", px: 3, textAlign: "center" }}>
          <Typography variant="h3" sx={{ fontWeight: 700, mb: 2, fontSize: { xs: 32, md: 44 } }}>
            Sua agenda, sempre aberta
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 400, mb: 4, opacity: 0.9 }}>
            A Luz é a plataforma de agendamento online pro seu salão ou barbearia. Cliente marca
            sozinho, você gerencia tudo num painel só.
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="center" sx={{ flexWrap: "wrap", gap: 2 }}>
            <Button component={Link} href="/cadastro" variant="contained" color="secondary" size="large">
              Criar meu salão grátis
            </Button>
            {salesPhone && (
              <Button
                href={whatsappLink(salesPhone, "Olá! Quero saber mais sobre a Luz.")}
                target="_blank"
                rel="noreferrer"
                variant="outlined"
                size="large"
                sx={{ color: "inherit", borderColor: "currentColor" }}
              >
                Falar no WhatsApp
              </Button>
            )}
          </Stack>
        </Box>
      </Box>

      <Box sx={{ maxWidth: 960, mx: "auto", px: 3, py: { xs: 5, md: 8 } }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 3, textAlign: "center" }}>
          Problemas que todo salão conhece
        </Typography>
        <Stack direction="row" spacing={2.5} sx={{ flexWrap: "wrap" }}>
          {PAINS.map((p) => (
            <Paper key={p.title} elevation={1} sx={{ p: 2.5, flex: "1 1 260px" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                {p.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {p.body}
              </Typography>
            </Paper>
          ))}
        </Stack>
      </Box>

      <Box sx={{ bgcolor: "grey.50", py: { xs: 5, md: 8 } }}>
        <Box sx={{ maxWidth: 960, mx: "auto", px: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 3, textAlign: "center" }}>
            Como funciona
          </Typography>
          <Stack direction="row" spacing={2.5} sx={{ flexWrap: "wrap" }}>
            {STEPS.map((s) => (
              <Paper key={s.title} elevation={0} variant="outlined" sx={{ p: 2.5, flex: "1 1 260px" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  {s.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {s.body}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </Box>
      </Box>

      <Box sx={{ maxWidth: 960, mx: "auto", px: 3, py: { xs: 5, md: 8 } }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 3, textAlign: "center" }}>
          Tudo que seu salão precisa
        </Typography>
        <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }}>
          {FEATURES.map((f) => (
            <Paper key={f} elevation={1} sx={{ p: 1.75, flex: "1 1 280px" }}>
              <Typography variant="body2">✓ {f}</Typography>
            </Paper>
          ))}
        </Stack>
      </Box>

      <Box sx={{ bgcolor: "grey.50", py: { xs: 5, md: 8 } }}>
        <Box sx={{ maxWidth: 960, mx: "auto", px: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1, textAlign: "center" }}>
            Planos
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: "center" }}>
            50 dias grátis pra testar tudo, sem cartão de crédito.
          </Typography>
          <Stack direction="row" spacing={2.5} justifyContent="center" sx={{ flexWrap: "wrap" }}>
            {PLANS.map((plan) => (
              <Paper key={plan.value} elevation={1} sx={{ p: 3, flex: "1 1 220px", maxWidth: 260, textAlign: "center" }}>
                <Typography variant="overline" color="text.secondary">
                  {plan.label}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {formatPrice(plan.pricePerMonth)}
                  <Typography component="span" variant="body2" color="text.secondary">
                    /mês
                  </Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
                  {plan.sub}
                </Typography>
                <Button component={Link} href="/cadastro" variant="outlined" fullWidth>
                  Começar grátis
                </Button>
              </Paper>
            ))}
          </Stack>
        </Box>
      </Box>

      <Box sx={{ maxWidth: 720, mx: "auto", px: 3, py: { xs: 5, md: 8 } }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 3, textAlign: "center" }}>
          Perguntas frequentes
        </Typography>
        {FAQ.map((item) => (
          <Accordion key={item.q} disableGutters elevation={1} sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<span aria-hidden>▾</span>}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {item.q}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" color="text.secondary">
                {item.a}
              </Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>

      <Box sx={{ bgcolor: "primary.main", color: "primary.contrastText", py: { xs: 5, md: 7 }, textAlign: "center" }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
          Pronto pra abrir sua agenda online?
        </Typography>
        <Button component={Link} href="/cadastro" variant="contained" color="secondary" size="large">
          Criar meu salão grátis
        </Button>
      </Box>
    </Box>
  );
}
