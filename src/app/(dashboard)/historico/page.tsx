// F5: histórico de cancelados e remarcados, a partir de AppointmentEvent —
// quem fez (cliente, dono ou automático) e, pro reagendamento, o horário
// antigo e o novo. Também serve de auditoria geral (inclui os outros tipos
// de evento via filtro).
import { Box, Typography, Paper, Stack, Chip, TextField, MenuItem, Button } from "@mui/material";
import { getCurrentSalon } from "@/lib/currentSalon";
import { prisma } from "@/lib/prisma";
import { formatSalonDate, formatSalonTime } from "@/lib/timezone";
import { EVENT_LABEL, ACTOR_LABEL } from "@/lib/appointmentEvents";
import type { AppointmentEventType } from "@prisma/client";

const FILTERABLE_TYPES: Array<AppointmentEventType | "ALL"> = [
  "ALL",
  "CANCELLED",
  "RESCHEDULED",
  "CREATED",
  "PRESENCE_CONFIRMED",
  "COMPLETED",
  "NO_SHOW",
  "OUTCOME_REVERTED",
];

const TYPE_COLOR: Record<AppointmentEventType, "default" | "error" | "warning" | "success" | "info"> = {
  CREATED: "info",
  CANCELLED: "error",
  RESCHEDULED: "warning",
  PRESENCE_CONFIRMED: "success",
  COMPLETED: "success",
  NO_SHOW: "error",
  OUTCOME_REVERTED: "default",
};

function formatDateTime(date: Date) {
  return `${formatSalonDate(date, { day: "2-digit", month: "2-digit", year: "numeric" })} ${formatSalonTime(date)}`;
}

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; from?: string; to?: string }>;
}) {
  const { type, from, to } = await searchParams;
  const salon = await getCurrentSalon();

  const selectedType = FILTERABLE_TYPES.includes(type as AppointmentEventType)
    ? (type as AppointmentEventType)
    : "ALL";

  const events = await prisma.appointmentEvent.findMany({
    where: {
      salonId: salon.id,
      ...(selectedType !== "ALL" ? { type: selectedType } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(`${from}T00:00:00-03:00`) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59-03:00`) } : {}),
            },
          }
        : {}),
    },
    include: {
      appointment: { include: { client: true, service: true, professional: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 500, mb: 2 }}>
        Histórico
      </Typography>

      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Stack component="form" direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: "wrap" }}>
          <TextField select name="type" label="Tipo" size="small" defaultValue={selectedType} sx={{ minWidth: 200 }}>
            {FILTERABLE_TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {t === "ALL" ? "Todos" : EVENT_LABEL[t]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="date"
            name="from"
            label="De"
            size="small"
            defaultValue={from ?? ""}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            type="date"
            name="to"
            label="Até"
            size="small"
            defaultValue={to ?? ""}
            InputLabelProps={{ shrink: true }}
          />
          <Button type="submit" variant="contained" size="small">
            Filtrar
          </Button>
        </Stack>
      </Paper>

      <Paper elevation={1}>
        {events.length === 0 && (
          <Typography sx={{ p: 2 }} color="text.secondary">
            Nenhum evento encontrado com esse filtro.
          </Typography>
        )}
        {events.map((event) => (
          <Stack
            key={event.id}
            direction="row"
            alignItems="flex-start"
            spacing={1.5}
            sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}
          >
            <Chip label={EVENT_LABEL[event.type]} color={TYPE_COLOR[event.type]} size="small" />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {event.appointment.client.name} — {event.appointment.service.name} com{" "}
                {event.appointment.professional.name}
              </Typography>
              {event.type === "RESCHEDULED" && event.previousStartAt && event.newStartAt && (
                <Typography variant="caption" color="text.secondary" display="block">
                  De {formatDateTime(event.previousStartAt)} para {formatDateTime(event.newStartAt)}
                </Typography>
              )}
              {event.note && (
                <Typography variant="caption" color="text.secondary" display="block">
                  {event.note}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                {formatDateTime(event.createdAt)} — {ACTOR_LABEL[event.actor]}
              </Typography>
            </Box>
          </Stack>
        ))}
      </Paper>
    </Box>
  );
}
