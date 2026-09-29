// Conciliação manual de assinatura (pendência 4 do STATUS-DO-PROJETO.md):
// tela de administração da plataforma, fora do dashboard do dono, pra mudar
// Subscription.status depois de conferir o PIX recebido fora do sistema.
import { Box, Typography, Paper, Chip, Stack, Button } from "@mui/material";
import { prisma } from "@/lib/prisma";
import { setSubscriptionStatusAction } from "@/lib/actions/admin";
import { formatSalonDate } from "@/lib/timezone";

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

export default async function AdminPage() {
  const subscriptions = await prisma.subscription.findMany({
    include: { salon: { include: { owner: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 500, mb: 2 }}>
        Assinaturas
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Confira o PIX recebido fora do sistema (chave da plataforma, ver README) antes de ativar.
        Isso não é automático — cada clique aqui é uma ativação registrada manualmente.
      </Typography>

      <Stack spacing={1.5}>
        {subscriptions.map((sub) => (
          <Paper key={sub.id} elevation={1} sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ flexWrap: "wrap", gap: 1 }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                  {sub.salon.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {sub.salon.owner.email} · Plano {PLAN_LABEL[sub.plan] ?? sub.plan}
                  {sub.currentPeriodEnd
                    ? ` · renova em ${formatSalonDate(sub.currentPeriodEnd)}`
                    : ""}
                  {sub.activatedAt
                    ? ` · última ativação ${formatSalonDate(sub.activatedAt)}`
                    : ""}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={STATUS_LABEL[sub.status] ?? sub.status} color={STATUS_COLOR[sub.status]} size="small" />
                {sub.status !== "ACTIVE" && (
                  <form action={setSubscriptionStatusAction}>
                    <input type="hidden" name="subscriptionId" value={sub.id} />
                    <input type="hidden" name="status" value="ACTIVE" />
                    <Button type="submit" size="small" variant="contained">
                      Marcar como Ativa
                    </Button>
                  </form>
                )}
                {sub.status !== "PAST_DUE" && sub.status !== "CANCELLED" && (
                  <form action={setSubscriptionStatusAction}>
                    <input type="hidden" name="subscriptionId" value={sub.id} />
                    <input type="hidden" name="status" value="PAST_DUE" />
                    <Button type="submit" size="small" variant="outlined" color="warning">
                      Marcar pendente
                    </Button>
                  </form>
                )}
              </Stack>
            </Stack>
          </Paper>
        ))}
        {subscriptions.length === 0 && (
          <Typography color="text.secondary">Nenhuma assinatura cadastrada ainda.</Typography>
        )}
      </Stack>
    </Box>
  );
}
