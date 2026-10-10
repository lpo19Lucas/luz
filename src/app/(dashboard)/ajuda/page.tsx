// F11: dúvidas frequentes sobre como usar cada feature do dashboard.
// F10: botão de suporte via WhatsApp (NEXT_PUBLIC_SUPPORT_WHATSAPP) — some
// se a env não estiver configurada.
// Os textos usam o vocabulário do segmento ({client}, {professional}...) —
// ver `fill` abaixo e src/lib/segments.ts.
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import SupportButton from "./SupportButton";
import { getCurrentSalon } from "@/lib/currentSalon";
import { cap, getSegment, type SegmentVocab } from "@/lib/segments";

const FAQ: Array<{ topic: string; items: Array<{ q: string; a: string }> }> = [
  {
    topic: "Primeiros passos",
    items: [
      {
        q: "Por que meu link público não abre pra {clients}?",
        a: 'Em "Início" tem um checklist: pelo menos 1 serviço e 1 {professional} ativo (com horário e serviço vinculado). Depois de completar, clique em "Publicar meu link" — só a partir daí o link aceita agendamento.',
      },
      {
        q: "Como eu compartilho meu link com {clients}?",
        a: 'Em "Início" tem o botão "Copiar / compartilhar" — copia o link pra área de transferência (ou abre o compartilhamento nativo no celular). O link também aparece no topo do menu, em "Ver site público".',
      },
    ],
  },
  {
    topic: "{Professionals} e serviços",
    items: [
      {
        q: "Cadastrei {professional} mas não aparece na agenda pública",
        a: "Confira duas coisas: precisa estar marcado como ativo, e precisa ter pelo menos um horário de disponibilidade semanal e pelo menos um serviço vinculado (isso é configurado direto no cadastro/edição).",
      },
      {
        q: "Posso excluir {professional} ou serviço?",
        a: "Só se nunca teve agendamento. Se já teve, o sistema inativa em vez de excluir (quando é pessoa/espaço) ou simplesmente avisa que não dá (serviço) — pra não perder o histórico de agendamentos antigos.",
      },
    ],
  },
  {
    topic: "Horários e bloqueios",
    items: [
      {
        q: "Como bloqueio um feriado ou uma folga?",
        a: 'Em "Bloqueios", crie um bloqueio pontual (só um dia) ou recorrente (todo dia, ou toda semana num dia fixo). Deixe "{Professional}" vazio pra bloquear tudo (feriado), ou escolha um específico (folga individual). Pode bloquear o dia inteiro ou só uma faixa de horário.',
      },
      {
        q: "Como faço um agendamento pelo telefone ou no balcão?",
        a: 'Na "Agenda", clique em "+ Novo agendamento" (ou "+ Novo" no card de um específico). Dá pra escolher um horário da grade normal ou um "encaixe livre", que só checa se já não existe outro agendamento no mesmo horário.',
      },
    ],
  },
  {
    topic: "Confirmação de presença",
    items: [
      {
        q: "O que é a confirmação de presença?",
        a: 'Em "Configurações", você liga um pedido automático pra {client} confirmar que vai comparecer, com antecedência configurável. Se não confirmar a tempo, você escolhe: só alertar (aparece um aviso vermelho na Agenda) ou liberar o horário automaticamente.',
      },
      {
        q: "O que é a diferença entre 'não confirmou' e 'não compareceu'?",
        a: '"Não confirmou" é automático, antes do horário ({client} não respondeu o pedido de confirmação). "Não compareceu" é manual, você marca na Agenda depois que o horário passou e {client} não apareceu — isso é o que entra na taxa de no-show das Métricas.',
      },
    ],
  },
  {
    topic: "{Clients}",
    items: [
      {
        q: "Como vejo quanto já foi gasto por {client}?",
        a: 'Em "{Clients}", cada ficha mostra visitas, total gasto, ticket médio e última visita — contando só o que foi marcado como "Concluído". Clique em "Ver" pra abrir o histórico completo e deixar anotações.',
      },
      {
        q: "Como impeço alguém problemático de agendar de novo?",
        a: 'Abra a ficha em "{Clients}" e clique em "Banir", com um motivo opcional (só você vê o motivo — a pessoa recebe uma mensagem neutra, sem saber que foi banida). Dá pra desbanir a qualquer momento.',
      },
    ],
  },
  {
    topic: "Assinatura",
    items: [
      {
        q: "Como funciona o período de teste?",
        a: 'Toda conta nova começa com 50 dias grátis. Em "Assinatura" você acompanha quantos dias faltam e escolhe o plano (mensal, trimestral ou anual) pra quando o teste acabar.',
      },
      {
        q: "Como eu pago?",
        a: 'Em "Assinatura" tem a chave PIX da plataforma — depois de pagar, a equipe da DLJ Innovations confirma manualmente (ainda não tem confirmação automática).',
      },
    ],
  },
];

/** Troca os marcadores {client}, {Clients}... pelo vocabulário do segmento. */
function fill(text: string, vocab: SegmentVocab) {
  const words: Record<string, string> = {
    client: vocab.client,
    clients: vocab.clients,
    professional: vocab.professional,
    professionals: vocab.professionals,
    appointment: vocab.appointment,
    appointments: vocab.appointments,
    business: vocab.business,
  };
  return text.replace(/\{([A-Za-z]+)\}/g, (match, key: string) => {
    const lower = key.charAt(0).toLowerCase() + key.slice(1);
    const word = words[lower];
    if (!word) return match;
    return key.charAt(0) === key.charAt(0).toUpperCase() ? cap(word) : word;
  });
}

export default async function AjudaPage() {
  const salon = await getCurrentSalon();
  const { vocab } = getSegment(salon.segment);

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Typography variant="h5" sx={{ fontWeight: 500, mb: 1 }}>
        Dúvidas frequentes
      </Typography>
      <Box sx={{ mb: 3 }}>
        <SupportButton />
      </Box>

      {FAQ.map((section) => (
        <Box key={section.topic} sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1 }}>
            {fill(section.topic, vocab)}
          </Typography>
          {section.items.map((item) => (
            <Accordion key={item.q} disableGutters elevation={1} sx={{ mb: 1 }}>
              <AccordionSummary expandIcon={<span aria-hidden>▾</span>}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {fill(item.q, vocab)}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary">
                  {fill(item.a, vocab)}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      ))}
    </Box>
  );
}
