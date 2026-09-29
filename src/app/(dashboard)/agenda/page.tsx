// Painel do dono — agenda consolidada por profissional (spec 8.10, P0.13).
// Referência visual: mui-exemplos.html (Exemplo 2).
import { Box, Typography, Paper, Chip, Stack, Button } from "@mui/material";
import Link from "next/link";
import { getCurrentSalon } from "@/lib/currentSalon";
import { prisma } from "@/lib/prisma";

const STATUS_LABEL: Record<string, string> = {
  AWAITING_CONFIRMATION: "Aguardando confirmação",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  COMPLETED: "Concluído",
};

const STATUS_COLOR: Record<string, "warning" | "primary" | "default" | "success"> = {
  AWAITING_CONFIRMATION: "warning",
  CONFIRMED: "primary",
  CANCELLED: "default",
  COMPLETED: "success",
};

function parseDate(value?: string) {
  if (!value) return new Date();
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const salon = await getCurrentSalon();
  const date = parseDate(dateParam);

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const professionals = await prisma.professional.findMany({
    where: { salonId: salon.id, active: true },
    include: {
      appointments: {
        where: { startAt: { gte: dayStart, lte: dayEnd } },
        include: { client: true, service: true },
        orderBy: { startAt: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const dateLabel = date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 500, textTransform: "capitalize" }}>
          {dateLabel}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button component={Link} href={`/agenda?date=${toISODate(addDays(date, -1))}`} size="small">
            ← Dia anterior
          </Button>
          <Button component={Link} href="/agenda" size="small" variant="outlined">
            Hoje
          </Button>
          <Button component={Link} href={`/agenda?date=${toISODate(addDays(date, 1))}`} size="small">
            Próximo dia →
          </Button>
        </Stack>
      </Stack>

      {professionals.length === 0 && (
        <Typography color="text.secondary">Nenhum profissional cadastrado ainda.</Typography>
      )}

      <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
        {professionals.map((prof) => (
          <Paper key={prof.id} elevation={1} sx={{ p: 2, flex: "1 1 260px", minWidth: 240 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1.5 }}>
              {prof.name}
            </Typography>
            {prof.appointments.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Sem agendamentos neste dia.
              </Typography>
            )}
            <Stack spacing={1}>
              {prof.appointments.map((appt) => (
                <Box
                  key={appt.id}
                  sx={{
                    p: 1.25,
                    borderRadius: 1,
                    bgcolor: appt.status === "CANCELLED" ? "grey.100" : "#E7E9F3",
                    opacity: appt.status === "CANCELLED" ? 0.6 : 1,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {appt.startAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    {" — "}
                    {appt.service.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {appt.client.name}
                  </Typography>
                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: "wrap", gap: 0.5 }}>
                    <Chip
                      label={STATUS_LABEL[appt.status]}
                      color={STATUS_COLOR[appt.status]}
                      size="small"
                    />
                    {appt.status === "AWAITING_CONFIRMATION" && appt.noShowHandledAt && (
                      <Chip
                        label="Cliente não confirmou — ligue ou cancele"
                        color="error"
                        size="small"
                      />
                    )}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
