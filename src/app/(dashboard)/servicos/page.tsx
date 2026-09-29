// CRUD de serviços (spec P0.4).
import { Box, Typography, Paper, Stack, TextField, Button } from "@mui/material";
import { revalidatePath } from "next/cache";
import { getCurrentSalon } from "@/lib/currentSalon";
import { prisma } from "@/lib/prisma";

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function createService(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const durationMinutes = Number(formData.get("durationMinutes"));
  const priceReais = Number(formData.get("price"));
  if (!name || !durationMinutes || Number.isNaN(priceReais)) return;

  const salon = await getCurrentSalon();
  await prisma.service.create({
    data: {
      salonId: salon.id,
      name,
      durationMinutes,
      priceCents: Math.round(priceReais * 100),
    },
  });
  revalidatePath("/servicos");
}

export default async function ServicosPage() {
  const salon = await getCurrentSalon();
  const services = await prisma.service.findMany({
    where: { salonId: salon.id },
    orderBy: { name: "asc" },
  });

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 500, mb: 2 }}>
        {services.length} serviço(s) cadastrado(s)
      </Typography>

      <Paper elevation={1} sx={{ mb: 3 }}>
        {services.length === 0 && (
          <Typography sx={{ p: 2 }} color="text.secondary">
            Nenhum serviço ainda.
          </Typography>
        )}
        {services.map((svc) => (
          <Stack
            key={svc.id}
            direction="row"
            alignItems="center"
            sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}
          >
            <Box sx={{ flexGrow: 1 }}>
              <Typography sx={{ fontWeight: 500 }}>{svc.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {svc.durationMinutes} min
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 700, color: "primary.main" }}>
              {formatPrice(svc.priceCents)}
            </Typography>
          </Stack>
        ))}
      </Paper>

      <Paper elevation={1} sx={{ p: 2.5, maxWidth: 480 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1.5 }}>
          Novo serviço
        </Typography>
        <Stack component="form" action={createService} spacing={1.5}>
          <TextField name="name" label="Nome" size="small" required />
          <Stack direction="row" spacing={1.5}>
            <TextField name="durationMinutes" label="Duração (min)" type="number" size="small" required />
            <TextField name="price" label="Preço (R$)" type="number" size="small" required inputProps={{ step: "0.01" }} />
          </Stack>
          <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>
            Adicionar
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
