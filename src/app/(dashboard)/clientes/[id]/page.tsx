// F8: detalhe do cliente — histórico de agendamentos, anotações do dono e
// banir/desbanir (F7) com motivo.
import { notFound } from "next/navigation";
import { Box, Typography, Paper, Stack, Chip, TextField, Button, Alert, MenuItem } from "@mui/material";
import Link from "next/link";
import { getCurrentSalon } from "@/lib/currentSalon";
import { prisma } from "@/lib/prisma";
import { getClientStats } from "@/lib/clientStats";
import { formatPhone, whatsappLink } from "@/lib/phone";
import { formatSalonDate, formatSalonTime } from "@/lib/timezone";
import { updateClientNotesAction, banClientAction, unbanClientAction } from "@/lib/actions/client";
import {
  sellPackageToClientAction,
  confirmPackagePaymentAction,
  cancelClientPackageAction,
} from "@/lib/actions/package";
import { getClientPackages } from "@/lib/packages";
import { assetSummary } from "@/lib/clientAssets";

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

  const [stats, appointments, clientPackages, packageDefinitions] = await Promise.all([
    getClientStats(salon.id, client.id),
    prisma.appointment.findMany({
      where: { salonId: salon.id, clientId: client.id },
      include: { service: true, professional: true, asset: true },
      orderBy: { startAt: "desc" },
      take: 50,
    }),
    getClientPackages(salon.id, client.id),
    prisma.packageDefinition.findMany({ where: { salonId: salon.id, active: true }, orderBy: { name: "asc" } }),
  ]);

  const PACKAGE_STATUS_LABEL: Record<string, string> = {
    PENDING_PAYMENT: "Aguardando pagamento",
    ACTIVE: "Ativo",
    CANCELLED: "Cancelado",
  };

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

      <Paper elevation={1} sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500, p: 2, pb: 0 }}>
          Pacotes do cliente
        </Typography>
        {clientPackages.length === 0 && (
          <Typography sx={{ p: 2 }} color="text.secondary">
            Nenhum pacote ainda.
          </Typography>
        )}
        {clientPackages.map((cp) => {
          const expired = cp.status === "ACTIVE" && cp.expiresAt !== null && cp.expiresAt < new Date();
          return (
            <Stack
              key={cp.id}
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body2">{cp.packageDefinition.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {cp.packageDefinition.type === "SERVICE_CREDITS"
                    ? `${cp.remainingCredits ?? "—"} crédito(s) restante(s)`
                    : `${formatPrice(cp.remainingValueCents ?? 0)} restante`}
                  {cp.expiresAt && ` · válido até ${formatSalonDate(cp.expiresAt, { day: "2-digit", month: "2-digit", year: "numeric" })}`}
                </Typography>
              </Box>
              <Chip
                label={expired ? "Expirado" : PACKAGE_STATUS_LABEL[cp.status] ?? cp.status}
                size="small"
                color={cp.status === "ACTIVE" && !expired ? "success" : "default"}
              />
              {cp.status === "PENDING_PAYMENT" && (
                <form action={confirmPackagePaymentAction}>
                  <input type="hidden" name="clientPackageId" value={cp.id} />
                  <input type="hidden" name="clientId" value={client.id} />
                  <Button type="submit" size="small" variant="outlined">
                    Confirmar pagamento
                  </Button>
                </form>
              )}
              {cp.status !== "CANCELLED" && (
                <form action={cancelClientPackageAction}>
                  <input type="hidden" name="clientPackageId" value={cp.id} />
                  <input type="hidden" name="clientId" value={client.id} />
                  <Button type="submit" size="small" color="error">
                    Cancelar
                  </Button>
                </form>
              )}
            </Stack>
          );
        })}
        {packageDefinitions.length > 0 && (
          <Stack component="form" action={sellPackageToClientAction} direction="row" spacing={1.5} sx={{ p: 2 }}>
            <input type="hidden" name="clientId" value={client.id} />
            <TextField name="packageDefinitionId" label="Vender pacote" size="small" select fullWidth required>
              {packageDefinitions.map((def) => (
                <MenuItem key={def.id} value={def.id}>
                  {def.name} — {formatPrice(def.priceCents)}
                </MenuItem>
              ))}
            </TextField>
            <Button type="submit" variant="contained" sx={{ flexShrink: 0 }}>
              Vender
            </Button>
          </Stack>
        )}
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
                {appt.asset ? ` · ${assetSummary(appt.asset)}` : ""}
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
