// Painel de métricas: faturamento total/por profissional/por serviço (P0.16),
// ticket médio e taxa de no-show (P1, priorizadas na última revisão da spec).
// Referência visual: mui-exemplos.html (Exemplo 3).
import { Box, Typography, Paper, Stack, LinearProgress, Alert, Button } from "@mui/material";
import Link from "next/link";
import { getCurrentSalon } from "@/lib/currentSalon";
import { prisma } from "@/lib/prisma";
import { AWAITING_OUTCOME_STATUSES } from "@/lib/appointmentOutcome";
import { appointmentPriceCents } from "@/lib/clientAssets";

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function MetricasPage() {
  const salon = await getCurrentSalon();

  const completed = await prisma.appointment.findMany({
    where: { salonId: salon.id, status: "COMPLETED" },
    include: { service: true, professional: true },
  });

  // No-show: só o que o dono marcou como "Não compareceu" na Agenda.
  const noShowCount = await prisma.appointment.count({
    where: { salonId: salon.id, status: "NO_SHOW" },
  });

  // Horário já passou mas o dono ainda não marcou o desfecho — não entra em
  // nenhuma métrica (nem faturamento, nem no-show) até ser marcado.
  const awaitingOutcomeCount = await prisma.appointment.count({
    where: {
      salonId: salon.id,
      status: { in: [...AWAITING_OUTCOME_STATUSES] },
      startAt: { lt: new Date() },
    },
  });

  const totalPastCount = completed.length + noShowCount;
  const noShowRate = totalPastCount > 0 ? (noShowCount / totalPastCount) * 100 : 0;

  const totalRevenueCents = completed.reduce((sum, a) => sum + appointmentPriceCents(a), 0);
  const ticketMedioCents = completed.length > 0 ? totalRevenueCents / completed.length : 0;

  const revenueByProfessional = new Map<string, { name: string; cents: number }>();
  for (const appt of completed) {
    const entry = revenueByProfessional.get(appt.professionalId) ?? {
      name: appt.professional.name,
      cents: 0,
    };
    entry.cents += appointmentPriceCents(appt);
    revenueByProfessional.set(appt.professionalId, entry);
  }
  const revenueRows = [...revenueByProfessional.values()].sort((a, b) => b.cents - a.cents);
  const maxRevenue = Math.max(1, ...revenueRows.map((r) => r.cents));

  const stats = [
    { label: "Faturamento (concluídos)", value: formatPrice(totalRevenueCents) },
    { label: "Ticket médio", value: formatPrice(ticketMedioCents) },
    { label: "Agendamentos concluídos", value: String(completed.length) },
    { label: "Taxa de no-show", value: `${noShowRate.toFixed(0)}%` },
  ];

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 500, mb: 2 }}>
        Métricas
      </Typography>

      {awaitingOutcomeCount > 0 && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button component={Link} href="/agenda" color="inherit" size="small">
              Ir para a agenda
            </Button>
          }
        >
          {awaitingOutcomeCount === 1
            ? "1 atendimento que já passou ainda não foi marcado como concluído ou não compareceu."
            : `${awaitingOutcomeCount} atendimentos que já passaram ainda não foram marcados como concluídos ou não compareceu.`}{" "}
          Eles só entram nas métricas depois de marcados.
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: "wrap" }}>
        {stats.map((s) => (
          <Paper key={s.label} elevation={1} sx={{ p: 2, flex: "1 1 200px" }}>
            <Typography variant="caption" color="text.secondary">
              {s.label}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {s.value}
            </Typography>
          </Paper>
        ))}
      </Stack>

      <Paper elevation={1} sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 2 }}>
          Faturamento por profissional
        </Typography>
        {revenueRows.length === 0 && (
          <Typography color="text.secondary">Nenhum agendamento concluído ainda.</Typography>
        )}
        <Stack spacing={1.5}>
          {revenueRows.map((row) => (
            <Stack key={row.name} direction="row" alignItems="center" spacing={1.5}>
              <Typography variant="body2" sx={{ width: 100, flexShrink: 0 }}>
                {row.name}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(row.cents / maxRevenue) * 100}
                sx={{ flexGrow: 1, height: 10, borderRadius: 1 }}
              />
              <Typography variant="body2" sx={{ width: 90, textAlign: "right" }}>
                {formatPrice(row.cents)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Paper>
    </Box>
  );
}
