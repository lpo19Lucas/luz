// Painel do dono — agenda consolidada por profissional (spec 8.10, P0.13).
// Referência visual: mui-exemplos.html (Exemplo 2).
import { Box, Typography, Paper, Chip, Stack, Button } from "@mui/material";
import Link from "next/link";
import { getCurrentSalon } from "@/lib/currentSalon";
import { setAppointmentOutcomeAction } from "@/lib/actions/appointment";
import { prisma } from "@/lib/prisma";
import { salonMidnightUTC, salonEndOfDayUTC, formatSalonDate, formatSalonTime } from "@/lib/timezone";

const STATUS_LABEL: Record<string, string> = {
  AWAITING_CONFIRMATION: "Aguardando confirmação",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  COMPLETED: "Concluído",
  NO_SHOW: "Não compareceu",
};

const STATUS_COLOR: Record<string, "warning" | "primary" | "default" | "success" | "error"> = {
  AWAITING_CONFIRMATION: "warning",
  CONFIRMED: "primary",
  CANCELLED: "default",
  COMPLETED: "success",
  NO_SHOW: "error",
};

/** Botão de um formulário que chama a server action de desfecho do atendimento. */
function OutcomeButton({
  appointmentId,
  outcome,
  label,
  color,
}: {
  appointmentId: string;
  outcome: "COMPLETED" | "NO_SHOW" | "PENDING";
  label: string;
  color: "success" | "error" | "inherit";
}) {
  return (
    <form action={setAppointmentOutcomeAction}>
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="outcome" value={outcome} />
      <Button type="submit" size="small" color={color} sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 12 }}>
        {label}
      </Button>
    </form>
  );
}

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
  copy.setUTCDate(copy.getUTCDate() + days);
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

  const dayStart = salonMidnightUTC(date);
  const dayEnd = salonEndOfDayUTC(date);

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

  const now = new Date();

  const dateLabel = formatSalonDate(date, {
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
                    {formatSalonTime(appt.startAt)}
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
                    {appt.status === "AWAITING_CONFIRMATION" && appt.noShowHandledAt && appt.startAt > now && (
                      <Chip
                        label="Cliente não confirmou — ligue ou cancele"
                        color="error"
                        size="small"
                      />
                    )}
                  </Stack>
                  {/* Depois que o horário começa, o dono marca o desfecho — é isso
                      que alimenta faturamento, ticket médio e taxa de no-show. */}
                  {appt.startAt <= now &&
                    (appt.status === "CONFIRMED" || appt.status === "AWAITING_CONFIRMATION") && (
                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }}>
                        <OutcomeButton appointmentId={appt.id} outcome="COMPLETED" label="✓ Concluído" color="success" />
                        <OutcomeButton appointmentId={appt.id} outcome="NO_SHOW" label="✗ Não compareceu" color="error" />
                      </Stack>
                    )}
                  {(appt.status === "COMPLETED" || appt.status === "NO_SHOW") && (
                    <Box sx={{ mt: 0.5 }}>
                      <OutcomeButton appointmentId={appt.id} outcome="PENDING" label="Desfazer" color="inherit" />
                    </Box>
                  )}
                </Box>
              ))}
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
