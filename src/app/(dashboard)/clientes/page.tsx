// F8: lista de clientes, com busca por nome ou telefone. F1: faturamento por
// cliente (visitas, total gasto, ticket médio). F7: destaque visual de quem
// está banido.
import { Box, Typography, Paper, Stack, TextField, Button, Chip } from "@mui/material";
import Link from "next/link";
import { getCurrentSalon } from "@/lib/currentSalon";
import { prisma } from "@/lib/prisma";
import { getAllClientStats } from "@/lib/clientStats";
import { formatPhone, whatsappLink } from "@/lib/phone";
import { formatSalonDate } from "@/lib/timezone";
import { cap, getSegment } from "@/lib/segments";

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const salon = await getCurrentSalon();

  const clients = await prisma.client.findMany({
    where: {
      salonId: salon.id,
      ...(q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q.replace(/\D/g, "") } }] }
        : {}),
    },
    orderBy: { name: "asc" },
  });

  const statsByClient = await getAllClientStats(salon.id);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 500, mb: 2 }}>
        {cap(getSegment(salon.segment).vocab.clients)}
      </Typography>

      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Stack component="form" direction="row" spacing={1.5}>
          <TextField
            name="q"
            label="Buscar por nome ou telefone"
            size="small"
            defaultValue={q ?? ""}
            fullWidth
          />
          <Button type="submit" variant="contained">
            Buscar
          </Button>
        </Stack>
      </Paper>

      <Paper elevation={1}>
        {clients.length === 0 && (
          <Typography sx={{ p: 2 }} color="text.secondary">
            Nenhum cliente encontrado.
          </Typography>
        )}
        {clients.map((client) => {
          const stats = statsByClient.get(client.id);
          return (
            <Stack
              key={client.id}
              direction="row"
              alignItems="center"
              spacing={2}
              sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}
            >
              <Box sx={{ flex: "1 1 220px", minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography
                    component={Link}
                    href={`/clientes/${client.id}`}
                    sx={{ fontWeight: 500, color: "inherit", textDecoration: "none" }}
                  >
                    {client.name}
                  </Typography>
                  {client.bannedAt && <Chip label="Banido" color="error" size="small" />}
                </Stack>
                <Typography
                  component="a"
                  href={whatsappLink(client.phone)}
                  target="_blank"
                  rel="noreferrer"
                  variant="caption"
                  color="text.secondary"
                  sx={{ textDecoration: "none" }}
                >
                  {formatPhone(client.phone)} ↗
                </Typography>
              </Box>
              <Box sx={{ width: 90, textAlign: "right" }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Visitas
                </Typography>
                <Typography variant="body2">{stats?.visitCount ?? 0}</Typography>
              </Box>
              <Box sx={{ width: 110, textAlign: "right" }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Total gasto
                </Typography>
                <Typography variant="body2">{formatPrice(stats?.totalSpentCents ?? 0)}</Typography>
              </Box>
              <Box sx={{ width: 100, textAlign: "right" }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Ticket médio
                </Typography>
                <Typography variant="body2">{formatPrice(stats?.averageTicketCents ?? 0)}</Typography>
              </Box>
              <Box sx={{ width: 130, textAlign: "right" }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Última visita
                </Typography>
                <Typography variant="body2">
                  {stats?.lastVisitAt ? formatSalonDate(stats.lastVisitAt, { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}
                </Typography>
              </Box>
              <Box sx={{ width: 70, textAlign: "right" }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Faltas
                </Typography>
                <Typography variant="body2">{stats?.noShowCount ?? 0}</Typography>
              </Box>
              <Button component={Link} href={`/clientes/${client.id}`} size="small">
                Ver
              </Button>
            </Stack>
          );
        })}
      </Paper>
    </Box>
  );
}
