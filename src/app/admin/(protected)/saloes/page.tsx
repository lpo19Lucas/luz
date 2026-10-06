// Lista de salões com busca (nome, slug, e-mail ou nome do dono) e filtro
// por situação.
import { Box, Typography, Paper, Stack, Chip, TextField, Button, MenuItem } from "@mui/material";
import Link from "next/link";
import { listSalonsForAdmin, periodEnd, SALON_FILTERS, type SalonFilter } from "@/lib/adminSalons";
import { PLAN_LABEL } from "@/lib/plans";
import { formatSalonDate } from "@/lib/timezone";
import { ACCESS_COLOR, ACCESS_LABEL, STATUS_COLOR, STATUS_LABEL } from "../labels";

export const dynamic = "force-dynamic";

export default async function AdminSaloesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtro?: string }>;
}) {
  const { q = "", filtro = "all" } = await searchParams;
  const filter = (filtro in SALON_FILTERS ? filtro : "all") as SalonFilter;
  const salons = await listSalonsForAdmin({ q, filter });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Salões ({salons.length})
        </Typography>
        <Button component={Link} href="/admin/saloes/novo" variant="contained">
          Novo salão
        </Button>
      </Stack>

      <Stack component="form" direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField name="q" defaultValue={q} size="small" label="Buscar" placeholder="Nome, link, e-mail ou dono" sx={{ flexGrow: 1 }} />
        <TextField name="filtro" select defaultValue={filter} size="small" label="Situação" sx={{ minWidth: 180 }}>
          {Object.entries(SALON_FILTERS).map(([value, label]) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <Button type="submit" variant="outlined">
          Filtrar
        </Button>
      </Stack>

      <Paper elevation={1}>
        {salons.length === 0 && (
          <Typography sx={{ p: 2 }} color="text.secondary">
            Nenhum salão encontrado.
          </Typography>
        )}
        {salons.map((s) => {
          const end = s.subscription ? periodEnd(s.subscription) : null;
          return (
            <Stack
              key={s.id}
              component={Link}
              href={`/admin/saloes/${s.id}`}
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "flex-start", sm: "center" }}
              spacing={{ xs: 1, sm: 2 }}
              sx={{ p: 1.75, borderBottom: "1px solid", borderColor: "divider", color: "inherit", textDecoration: "none", "&:hover": { bgcolor: "action.hover" } }}
            >
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>
                  {s.name}{" "}
                  <Typography component="span" variant="caption" color="text.secondary">
                    /{s.slug}
                  </Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  {s.owner.name} · {s.owner.email}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {s._count.professionals} profissional(is) · {s._count.services} serviço(s) · {s._count.appointments} agendamento(s) · desde{" "}
                  {formatSalonDate(s.createdAt)}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75 }}>
                {s.subscription && (
                  <Chip
                    size="small"
                    color={STATUS_COLOR[s.subscription.status]}
                    label={`${PLAN_LABEL[s.subscription.plan] ?? s.subscription.plan} · ${STATUS_LABEL[s.subscription.status]}`}
                  />
                )}
                <Chip size="small" variant="outlined" color={ACCESS_COLOR[s.access]} label={ACCESS_LABEL[s.access]} />
                {!s.publishedAt && <Chip size="small" variant="outlined" label="Não publicado" />}
                {s.owner.disabledAt && <Chip size="small" color="error" label="Acesso bloqueado" />}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 110, textAlign: { sm: "right" } }}>
                {end ? `vence ${formatSalonDate(end)}` : "sem vencimento"}
              </Typography>
            </Stack>
          );
        })}
      </Paper>
    </Box>
  );
}
