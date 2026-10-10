// Painel do dono — agenda consolidada por profissional (spec 8.10, P0.13).
// Referência visual: mui-exemplos.html (Exemplo 2).
import { Box, Typography, Paper, Chip, Stack, Button } from "@mui/material";
import Link from "next/link";
import { getCurrentSalon } from "@/lib/currentSalon";
import { setAppointmentOutcomeAction, cancelAppointmentOwnerAction } from "@/lib/actions/appointment";
import { prisma } from "@/lib/prisma";
import { whatsappReminderLink } from "@/lib/whatsappReminder";
import { assetSummary } from "@/lib/clientAssets";
import { salonMidnightUTC, salonEndOfDayUTC, salonWeekday, formatSalonDate, formatSalonTime } from "@/lib/timezone";
import { getAgendaKpis, type AgendaKpis } from "@/lib/agendaKpis";

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Cabeçalho de KPIs do dia e da semana (F2) — agendados, concluídos, faltas,
 * faturamento previsto/realizado e ocupação. */
function KpiHeader({ title, kpis }: { title: string; kpis: AgendaKpis }) {
  const occupancy =
    kpis.availableMinutes > 0 ? Math.round((kpis.occupiedMinutes / kpis.availableMinutes) * 100) : 0;

  const items: Array<{ label: string; value: string }> = [
    { label: "Agendados", value: String(kpis.scheduledCount) },
    { label: "Concluídos", value: String(kpis.completedCount) },
    { label: "Faltas", value: String(kpis.noShowCount) },
    { label: "Faturamento previsto", value: formatPrice(kpis.expectedRevenueCents) },
    { label: "Faturamento realizado", value: formatPrice(kpis.realizedRevenueCents) },
    { label: "Ocupação", value: `${occupancy}%` },
  ];

  return (
    <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 500, mb: 1.5 }}>
        {title}
      </Typography>
      <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
        {items.map((item) => (
          <Box key={item.label} sx={{ minWidth: 120 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              {item.label}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {item.value}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}

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

/** Botão "Cancelar" (B3) — cancelamento pelo dono, mesma regra de negócio do cliente. */
function CancelButton({ appointmentId }: { appointmentId: string }) {
  return (
    <form action={cancelAppointmentOwnerAction}>
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <Button
        type="submit"
        size="small"
        color="inherit"
        sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 12 }}
      >
        Cancelar
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

  const weekday = salonWeekday(date);
  const weekStart = salonMidnightUTC(addDays(date, -weekday));
  const weekEnd = salonEndOfDayUTC(addDays(date, 6 - weekday));

  const [dayKpis, weekKpis] = await Promise.all([
    getAgendaKpis(salon.id, dayStart, dayEnd),
    getAgendaKpis(salon.id, weekStart, weekEnd),
  ]);

  const professionals = await prisma.professional.findMany({
    where: { salonId: salon.id, active: true },
    include: {
      appointments: {
        where: { startAt: { gte: dayStart, lte: dayEnd } },
        include: { client: true, service: true, asset: true },
        orderBy: { startAt: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const now = new Date();
  // Clientes do dia com notificação push ativa — pros outros, o card mostra
  // "Lembrar no WhatsApp" em destaque (E5).
  const dayClientIds = professionals.flatMap((p) => p.appointments.map((a) => a.clientId));
  const clientsWithPush = new Set(
    (
      await prisma.pushSubscription.findMany({
        where: { salonId: salon.id, clientId: { in: dayClientIds } },
        select: { clientId: true },
      })
    ).map((s) => s.clientId)
  );

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
          <Button
            component={Link}
            href={`/agenda/novo?date=${toISODate(date)}`}
            size="small"
            variant="contained"
          >
            + Novo agendamento
          </Button>
        </Stack>
      </Stack>

      <KpiHeader title="Dia selecionado" kpis={dayKpis} />
      <KpiHeader title="Esta semana" kpis={weekKpis} />

      {professionals.length === 0 && (
        <Typography color="text.secondary">Nenhum profissional cadastrado ainda.</Typography>
      )}

      <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap" }}>
        {professionals.map((prof) => (
          <Paper key={prof.id} elevation={1} sx={{ p: 2, flex: "1 1 260px", minWidth: 240 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                {prof.name}
              </Typography>
              <Button
                component={Link}
                href={`/agenda/novo?professionalId=${prof.id}&date=${toISODate(date)}`}
                size="small"
              >
                + Novo
              </Button>
            </Stack>
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
                    {appt.asset ? ` · ${assetSummary(appt.asset)}` : ""}
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
                  {/* Antes do horário começar, o dono pode cancelar ou remarcar
                      (B3) — remarcar reusa a mesma tela do link público do cliente. */}
                  {appt.startAt > now &&
                    (appt.status === "CONFIRMED" || appt.status === "AWAITING_CONFIRMATION") && (
                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.75, flexWrap: "wrap", gap: 0.5 }}>
                        <CancelButton appointmentId={appt.id} />
                        <Button
                          component={Link}
                          href={`/${salon.slug}/agendamento/${appt.accessToken}`}
                          size="small"
                          sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 12 }}
                        >
                          Remarcar
                        </Button>
                        {clientsWithPush.has(appt.clientId) ? (
                          <Chip label="🔔 recebe lembrete" size="small" variant="outlined" title="O cliente ativou as notificações do app" />
                        ) : (
                          <Button
                            component="a"
                            href={whatsappReminderLink({ ...appt, professionalName: prof.name, salon })}
                            target="_blank"
                            rel="noopener"
                            size="small"
                            color="success"
                            sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 12 }}
                            title="Cliente sem notificações ativas — abre o WhatsApp com o lembrete pronto"
                          >
                            Lembrar no WhatsApp
                          </Button>
                        )}
                      </Stack>
                    )}
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
