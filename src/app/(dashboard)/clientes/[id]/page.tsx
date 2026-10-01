// F8: detalhe do cliente — histórico de agendamentos, anotações do dono e
// banir/desbanir (F7) com motivo.
import { notFound } from "next/navigation";
import { Box, Typography, Paper, Stack, Chip, TextField, Button, Alert } from "@mui/material";
import Link from "next/link";
import { getCurrentSalon } from "@/lib/currentSalon";
import { prisma } from "@/lib/prisma";
import { getClientStats } from "@/lib/clientStats";
import { formatPhone, whatsappLink } from "@/lib/phone";
import { formatSalonDate, formatSalonTime } from "@/lib/timezone";
import { updateClientNotesAction, banClientAction, unbanClientAction } from "@/lib/actions/client";

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_LABEL: Record<string, string> = {
  AWAITING_CONFIRMATION: "Aguardando confirmação",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  COMPLETED: "Concluído",
  NO_SHOW: "Não compareceu",
};

export default async function ClienteDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const salon = await getCurrentSalon();

  const client = await prisma.client.findFirst({ where: { id, salonId: salon.id } });
  if (!client) notFound();

  const [stats, appointments] = await Promise.all([
    getClientStats(salon.id, client.id),
    prisma.appointment.findMany({
      where: { salonId: salon.id, clientId: client.id },
      include: { service: true, professional: true },
      orderBy: { startAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <Box sx={{ maxWidth: 760 }}>
      <Button component={Link} href="/clientes" size="small" sx={{ mb: 2 }}>
        ← Voltar pra clientes
      </Button>

      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 500 }}>
          {client.name}
        </Typography>
        {client.bannedAt && <Chip label="Banido" color="error" size="small" />}
      </Stack>
      <Typography
        component="a"
        href={whatsappLink(client.phone)}
        target="_blank"
        rel="noreferrer"
        variant="body2"
        color="text.secondary"
        sx={{ textDecoration: "none" }}
      >
        {formatPhone(client.phone)} — abrir no WhatsApp ↗
      </Typography>

      <Stack direction="row" spacing={2} sx={{ my: 3, flexWrap: "wrap" }}>
        {[
          { label: "Visitas", value: String(stats.visitCount) },
          { label: "Total gasto", value: formatPrice(stats.totalSpentCents) },
          { label: "Ticket médio", value: formatPrice(stats.averageTicketCents) },
          {
            label: "Última visita",
            value: stats.lastVisitAt
              ? formatSalonDate(stats.lastVisitAt, { day: "2-digit", month: "2-digit", year: "numeric" })
              : "—",
          },
          { label: "Faltas", value: String(stats.noShowCount) },
        ].map((s) => (
          <Paper key={s.label} elevation={1} sx={{ p: 2, flex: "1 1 140px" }}>
            <Typography variant="caption" color="text.secondary">
              {s.label}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {s.value}
            </Typography>
          </Paper>
        ))}
      </Stack>

      <Paper elevation={1} sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1.5 }}>
          {client.bannedAt ? "Cliente banido" : "Banir cliente"}
        </Typography>
        {client.bannedAt ? (
          <Stack spacing={1.5} alignItems="flex-start">
            {client.banReason && <Alert severity="warning">Motivo: {client.banReason}</Alert>}
            <form action={unbanClientAction}>
              <input type="hidden" name="id" value={client.id} />
              <Button type="submit" variant="outlined">
                Desbanir
              </Button>
            </form>
          </Stack>
        ) : (
          <Stack component="form" action={banClientAction} direction="row" spacing={1.5}>
            <input type="hidden" name="id" value={client.id} />
            <TextField name="reason" label="Motivo (opcional)" size="small" fullWidth />
            <Button type="submit" color="error" variant="outlined" sx={{ flexShrink: 0 }}>
              Banir
            </Button>
          </Stack>
        )}
      </Paper>

      <Paper elevation={1} sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1.5 }}>
          Anotações
        </Typography>
        <Stack component="form" action={updateClientNotesAction} spacing={1.5}>
          <input type="hidden" name="id" value={client.id} />
          <TextField
            name="notes"
            multiline
            minRows={3}
            defaultValue={client.notes ?? ""}
            placeholder="Preferências, observações sobre o cliente..."
          />
          <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>
            Salvar
          </Button>
        </Stack>
      </Paper>

      <Paper elevation={1}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500, p: 2, pb: 0 }}>
          Histórico de agendamentos
        </Typography>
        {appointments.length === 0 && (
          <Typography sx={{ p: 2 }} color="text.secondary">
            Nenhum agendamento ainda.
          </Typography>
        )}
        {appointments.map((appt) => (
          <Stack
            key={appt.id}
            direction="row"
            alignItems="center"
            spacing={1.5}
            sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}
          >
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="body2">
                {appt.service.name} com {appt.professional.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatSalonDate(appt.startAt, { day: "2-digit", month: "2-digit", year: "numeric" })}{" "}
                {formatSalonTime(appt.startAt)}
              </Typography>
            </Box>
            <Chip label={STATUS_LABEL[appt.status] ?? appt.status} size="small" />
          </Stack>
        ))}
      </Paper>
    </Box>
  );
}
