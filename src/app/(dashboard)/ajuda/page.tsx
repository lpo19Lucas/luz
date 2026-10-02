// F11: dúvidas frequentes sobre como usar cada feature do dashboard.
// F10: botão de suporte via WhatsApp (NEXT_PUBLIC_SUPPORT_WHATSAPP) — some
// se a env não estiver configurada.
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import SupportButton from "./SupportButton";

const FAQ: Array<{ topic: string; items: Array<{ q: string; a: string }> }> = [
  {
    topic: "Primeiros passos",
    items: [
      {
        q: "Por que meu link público não abre pra clientes?",
        a: 'Em "Início" tem um checklist: salão com pelo menos 1 serviço e 1 profissional ativo (com horário e serviço vinculado). Depois de completar, clique em "Publicar meu link" — só a partir daí o link aceita agendamento.',
      },
      {
        q: "Como eu compartilho meu link com os clientes?",
        a: 'Em "Início" tem o botão "Copiar / compartilhar" — copia o link pra área de transferência (ou abre o compartilhamento nativo no celular). O link também aparece no topo do menu, em "Ver site público".',
      },
    ],
  },
  {
    topic: "Profissionais e serviços",
    items: [
      {
        q: "Cadastrei um profissional mas ele não aparece na agenda pro cliente",
        a: "Confira duas coisas: o profissional precisa estar marcado como ativo, e precisa ter pelo menos um horário de disponibilidade semanal e pelo menos um serviço vinculado (isso é configurado direto no cadastro/edição do profissional).",
      },
      {
        q: "Posso excluir um profissional ou serviço?",
        a: "Só se ele nunca teve agendamento. Se já teve, o sistema inativa em vez de excluir (profissional) ou simplesmente avisa que não dá (serviço) — pra não perder o histórico de agendamentos antigos.",
      },
    ],
  },
  {
    topic: "Horários e bloqueios",
    items: [
      {
        q: "Como bloqueio um feriado ou uma folga?",
        a: 'Em "Bloqueios", crie um bloqueio pontual (só um dia) ou recorrente (todo dia, ou toda semana num dia fixo). Deixe "Profissional" vazio pra bloquear o salão inteiro (feriado), ou escolha um profissional específico (folga individual). Pode bloquear o dia inteiro ou só uma faixa de horário.',
      },
      {
        q: "Como faço um agendamento pelo telefone ou no balcão?",
        a: 'Na "Agenda", clique em "+ Novo agendamento" (ou "+ Novo" no card de um profissional específico). Dá pra escolher um horário da grade normal ou um "encaixe livre", que só checa se o profissional já não tem outro agendamento no mesmo horário.',
      },
    ],
  },
  {
    topic: "Confirmação de presença",
    items: [
      {
        q: "O que é a confirmação de presença?",
        a: 'Em "Configurações", você liga um pedido automático pro cliente confirmar que vai aparecer, com antecedência configurável. Se ele não confirmar a tempo, você escolhe: só alertar (aparece um aviso vermelho na Agenda) ou liberar o horário automaticamente pra outro cliente.',
      },
      {
        q: "O que é a diferença entre 'não confirmou' e 'não compareceu'?",
        a: '"Não confirmou" é automático, antes do horário (o cliente não respondeu o pedido de confirmação). "Não compareceu" é manual, você marca na Agenda depois que o horário passou e o cliente não apareceu — isso é o que entra na taxa de no-show das Métricas.',
      },
    ],
  },
  {
    topic: "Clientes",
    items: [
      {
        q: "Como vejo quanto um cliente já gastou no salão?",
        a: 'Em "Clientes", cada cliente mostra visitas, total gasto, ticket médio e última visita — contando só os atendimentos marcados como "Concluído". Clique em "Ver" pra abrir o histórico completo e deixar anotações.',
      },
      {
        q: "Como impeço um cliente problemático de agendar de novo?",
        a: 'Abra o cliente em "Clientes" e clique em "Banir", com um motivo opcional (só você vê o motivo — o cliente recebe uma mensagem neutra, sem saber que foi banido). Dá pra desbanir a qualquer momento.',
      },
    ],
  },
  {
    topic: "Assinatura",
    items: [
      {
        q: "Como funciona o período de teste?",
        a: 'Todo salão novo começa com 50 dias grátis. Em "Assinatura" você acompanha quantos dias faltam e escolhe o plano (mensal, trimestral ou anual) pra quando o teste acabar.',
      },
      {
        q: "Como eu pago?",
        a: 'Em "Assinatura" tem a chave PIX da plataforma — depois de pagar, o Lucas confirma manualmente (ainda não tem confirmação automática).',
      },
    ],
  },
];

export default function AjudaPage() {
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
            {section.topic}
          </Typography>
          {section.items.map((item) => (
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
      ))}
    </Box>
  );
}
