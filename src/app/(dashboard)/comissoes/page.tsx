// Relatório de comissão por profissional (% individual, sem padrão de salão —
// ver src/lib/commissions.ts). Período opcional via querystring (?from=&to=),
// mesma ideia simples de filtro que o resto do dashboard usa em formulários GET.
import { Box, Typography, Paper, Stack, TextField, Button, Alert } from "@mui/material";
import Link from "next/link";
import { getCurrentSalon } from "@/lib/currentSalon";
import { getCommissionReport } from "@/lib/commissions";
import { getSegment, cap, businessOf, grammar } from "@/lib/segments";

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function ComissoesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const salon = await getCurrentSalon();
  const vocab = getSegment(salon.segment).vocab;
  const apptG = grammar(vocab.appointmentGender);

  const report = await getCommissionReport({
    salonId: salon.id,
    from: from ? new Date(`${from}T00:00:00Z`) : undefined,
    to: to ? new Date(`${to}T23:59:59Z`) : undefined,
  });

  const unconfigured = report.filter((r) => r.commissionCents === null);
  const totalCommissionCents = report.reduce((sum, r) => sum + (r.commissionCents ?? 0), 0);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 500, mb: 2 }}>
        Comissões
      </Typography>

      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Stack component="form" direction="row" spacing={1.5} alignItems="center">
          <TextField name="from" label="De" type="date" size="small" defaultValue={from ?? ""} InputLabelProps={{ shrink: true }} />
          <TextField name="to" label="Até" type="date" size="small" defaultValue={to ?? ""} InputLabelProps={{ shrink: true }} />
          <Button type="submit" variant="outlined">
            Filtrar
          </Button>
          {(from || to) && (
            <Button component={Link} href="/comissoes" variant="text">
              Limpar
            </Button>
          )}
        </Stack>
      </Paper>

      {unconfigured.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {unconfigured.length === 1 ? `1 ${vocab.professional} não tem` : `${unconfigured.length} ${vocab.professionals} não têm`}{" "}
          % de comissão configurada —{" "}
          <Link href="/profissionais" style={{ color: "inherit" }}>
            configure em {cap(vocab.professionals)}
          </Link>
          .
        </Alert>
      )}

      <Paper elevation={1} sx={{ p: 2.5, mb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Total de comissão no período
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {formatPrice(totalCommissionCents)}
        </Typography>
      </Paper>

      <Paper elevation={1}>
        {report.length === 0 && (
          <Typography sx={{ p: 2 }} color="text.secondary">
            {apptG.none} {vocab.appointment} concluíd{vocab.appointmentGender === "f" ? "a" : "o"} nesse período.
          </Typography>
        )}
        {report.map((row) => (
          <Stack
            key={row.professionalId}
            direction="row"
            alignItems="center"
            spacing={1.5}
            sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}
          >
            <Box sx={{ flexGrow: 1 }}>
              <Typography sx={{ fontWeight: 500 }}>{row.professionalName}</Typography>
              <Typography variant="caption" color="text.secondary">
                {row.appointmentsCount} {vocab.appointment}(s) · faturou {formatPrice(row.totalRevenueCents)}
                {row.commissionPercent !== null && ` · ${row.commissionPercent}%`}
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 700, color: row.commissionCents !== null ? "secondary.main" : "text.disabled" }}>
              {row.commissionCents !== null ? formatPrice(row.commissionCents) : "não configurado"}
            </Typography>
          </Stack>
        ))}
      </Paper>
    </Box>
  );
}
