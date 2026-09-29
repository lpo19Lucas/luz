// Tela de assinatura — mostra a chave/QR PIX da plataforma, plano atual,
// status (TRIAL/ACTIVE/PAST_DUE). Sem gateway: liberação é manual (spec
// seção 9/10). Referência visual: mui-exemplos.html (Exemplo 5).
import { Box, Typography, Paper, Chip, Stack, Button } from "@mui/material";
import { getCurrentSalon } from "@/lib/currentSalon";
import { prisma } from "@/lib/prisma";
import { chooseSubscriptionPlan } from "@/lib/actions/salon";

const PLANS = [
  { value: "MONTHLY", label: "Mensal", pricePerMonth: 79, sub: "cobrado todo mês" },
  { value: "QUARTERLY", label: "Trimestral", pricePerMonth: 69, sub: "R$ 207 a cada 3 meses" },
  { value: "YEARLY", label: "Anual", pricePerMonth: 59, sub: "R$ 708 uma vez ao ano" },
] as const;

const PLAN_LABEL: Record<string, string> = {
  TRIAL: "Trial",
  MONTHLY: "Mensal",
  QUARTERLY: "Trimestral",
  YEARLY: "Anual",
};

const STATUS_LABEL: Record<string, string> = {
  TRIAL: "Período de teste",
  ACTIVE: "Ativa",
  PAST_DUE: "Pagamento pendente",
  CANCELLED: "Cancelada",
};

const STATUS_COLOR: Record<string, "info" | "success" | "warning" | "default"> = {
  TRIAL: "info",
  ACTIVE: "success",
  PAST_DUE: "warning",
  CANCELLED: "default",
};

// PIX estático da plataforma (spec 8.8/9): não é por salão, é fixo — a
// conciliação de quem pagou é manual, feita por quem administra a plataforma.
const PLATFORM_PIX_KEY = "financeiro@plataforma-agendamento.com";

export default async function AssinaturaPage() {
  const salon = await getCurrentSalon();
  const subscription = await prisma.subscription.findUnique({ where: { salonId: salon.id } });

  if (!subscription) {
    return <Typography color="text.secondary">Nenhuma assinatura encontrada para este salão.</Typography>;
  }

  const daysLeft = Math.max(
    0,
    Math.ceil((subscription.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60_000))
  );

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 500, mb: 2 }}>
        Assinatura
      </Typography>

      <Paper elevation={1} sx={{ p: 3, maxWidth: 480, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
            Plano {PLAN_LABEL[subscription.plan] ?? subscription.plan}
          </Typography>
          <Chip label={STATUS_LABEL[subscription.status]} color={STATUS_COLOR[subscription.status]} size="small" />
        </Stack>
        {subscription.status === "TRIAL" && (
          <Typography variant="body2" color="text.secondary">
            {daysLeft > 0
              ? `${daysLeft} dia(s) restantes de teste gratuito.`
              : "Período de teste encerrado."}
          </Typography>
        )}
        {subscription.currentPeriodEnd && (
          <Typography variant="body2" color="text.secondary">
            Renovação em {subscription.currentPeriodEnd.toLocaleDateString("pt-BR")}
          </Typography>
        )}
      </Paper>

      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 2 }}>
          Escolher plano
        </Typography>
        <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
          {PLANS.map((plan) => (
            <Paper
              key={plan.value}
              variant="outlined"
              sx={{
                p: 2.5,
                flex: "1 1 180px",
                textAlign: "center",
                borderColor: subscription.plan === plan.value ? "primary.main" : "divider",
                borderWidth: subscription.plan === plan.value ? 2 : 1,
              }}
            >
              <Typography variant="overline" color="text.secondary">
                {plan.label}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                R$ {plan.pricePerMonth}
                <Typography component="span" variant="caption" color="text.secondary">
                  /mês
                </Typography>
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                {plan.sub}
              </Typography>
              <form action={chooseSubscriptionPlan}>
                <input type="hidden" name="plan" value={plan.value} />
                <Button
                  type="submit"
                  size="small"
                  variant={subscription.plan === plan.value ? "contained" : "outlined"}
                  fullWidth
                >
                  {subscription.plan === plan.value ? "Selecionado" : "Escolher"}
                </Button>
              </form>
            </Paper>
          ))}
        </Stack>
      </Paper>

      <Paper elevation={1} sx={{ p: 3, maxWidth: 480 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1 }}>
          Pagamento via PIX
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Não há cobrança automática. Faça o PIX para a chave abaixo e aguarde a confirmação
          manual — o status muda para &ldquo;Ativa&rdquo; depois que a equipe da plataforma conferir o
          pagamento.
        </Typography>
        <Paper variant="outlined" sx={{ p: 1.5, fontFamily: "monospace", fontSize: 14, bgcolor: "grey.50" }}>
          {PLATFORM_PIX_KEY}
        </Paper>
        {subscription.activatedAt && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            Última ativação confirmada em {subscription.activatedAt.toLocaleDateString("pt-BR")}
            {subscription.activatedManuallyByEmail ? ` por ${subscription.activatedManuallyByEmail}` : ""}.
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
