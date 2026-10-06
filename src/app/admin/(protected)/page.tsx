// Visão geral da plataforma: números principais e quem precisa de atenção
// (carência, bloqueio, teste ou plano vencendo).
import { Box, Typography, Paper, Stack, Button } from "@mui/material";
import Link from "next/link";
import { getPlatformOverview } from "@/lib/adminSalons";
import { formatBRL } from "@/lib/plans";
import { formatSalonDate } from "@/lib/timezone";
import { isEmailConfigured } from "@/lib/email";
import { isLegalEntityConfigured } from "@/lib/legal";

export const dynamic = "force-dynamic";

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Paper elevation={1} sx={{ p: 2, flex: "1 1 160px" }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography sx={{ fontSize: 26, fontWeight: 700 }}>{value}</Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Paper>
  );
}

export default async function AdminOverviewPage() {
  const o = await getPlatformOverview();
  const setupWarnings = [
    !isEmailConfigured() && "E-mail não configurado (RESEND_API_KEY): o \"esqueci minha senha\" não envia — gere o link pelo salão.",
    !isLegalEntityConfigured() && "Dados da empresa (LEGAL_*) não preenchidos: os Termos mostram \"[A DEFINIR]\".",
    !process.env.PLATFORM_PIX_KEY && "Chave PIX da plataforma (PLATFORM_PIX_KEY) não configurada.",
  ].filter(Boolean) as string[];

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        Visão geral
      </Typography>

      {setupWarnings.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, borderColor: "warning.main" }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Configuração pendente
          </Typography>
          {setupWarnings.map((w) => (
            <Typography key={w} variant="body2" color="text.secondary">
              • {w}
            </Typography>
          ))}
        </Paper>
      )}

      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 2, mb: 3 }}>
        <Tile label="Salões" value={o.totalSalons} hint={`${o.newLast30} novos em 30 dias`} />
        <Tile label="Receita mensal estimada" value={formatBRL(o.mrrCents)} hint={`${o.paying} pagante(s)`} />
        <Tile label="Em teste" value={o.trials} />
        <Tile label="Publicados" value={o.published} />
        <Tile label="Carência / bloqueados" value={`${o.access.GRACE} / ${o.access.BLOCKED}`} />
        <Tile label="Agendamentos (30 dias)" value={o.appointmentsLast30} />
      </Stack>

      <Paper elevation={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Precisa de atenção ({o.attention.length})
          </Typography>
          <Button component={Link} href="/admin/saloes" size="small">
            Ver todos os salões
          </Button>
        </Stack>
        {o.attention.length === 0 && (
          <Typography sx={{ p: 2 }} color="text.secondary">
            Nada pendente. 🎉
          </Typography>
        )}
        {o.attention.map((item) => (
          <Stack
            key={item.id}
            component={Link}
            href={`/admin/saloes/${item.id}`}
            direction="row"
            alignItems="center"
            spacing={2}
            sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider", color: "inherit", textDecoration: "none", "&:hover": { bgcolor: "action.hover" } }}
          >
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 500 }}>{item.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {item.email}
              </Typography>
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography variant="body2">{item.reason}</Typography>
              {item.date && (
                <Typography variant="caption" color="text.secondary">
                  {formatSalonDate(item.date)}
                </Typography>
              )}
            </Box>
          </Stack>
        ))}
      </Paper>
    </Box>
  );
}
