// CRUD de serviços (spec P0.4).
import { Box, Typography, Paper, Stack, TextField, Button, Avatar } from "@mui/material";
import Link from "next/link";
import { getCurrentSalon } from "@/lib/currentSalon";
import { prisma } from "@/lib/prisma";
import { createServiceAction, deleteServiceAction } from "@/lib/actions/service";
import ImageUploadField from "../ImageUploadField";
import { storedImageUrl } from "@/lib/storedImages";
import { assetKindForSalon, parseSizePrices } from "@/lib/clientAssets";
import SizePriceFields from "./SizePriceFields";

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function ServicosPage() {
  const salon = await getCurrentSalon();
  const assetKind = assetKindForSalon(salon);
  const services = await prisma.service.findMany({
    where: { salonId: salon.id },
    include: { appointments: { select: { id: true }, take: 1 } },
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
            spacing={1.5}
            sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}
          >
            <Avatar
              variant="rounded"
              src={storedImageUrl(svc.imageId) ?? undefined}
              alt={svc.name}
              sx={{ width: 44, height: 44, bgcolor: "grey.200", color: "text.secondary", fontSize: 18 }}
            >
              💇
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography sx={{ fontWeight: 500 }}>{svc.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {svc.durationMinutes} min
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 700, color: "primary.main" }}>
              {Object.keys(parseSizePrices(svc.sizePricesJson)).length > 0 ? "a partir de " : ""}
              {formatPrice(Math.min(svc.priceCents, ...Object.values(parseSizePrices(svc.sizePricesJson))))}
            </Typography>
            <Button component={Link} href={`/servicos/${svc.id}`} size="small">
              Editar
            </Button>
            <form action={deleteServiceAction}>
              <input type="hidden" name="id" value={svc.id} />
              <Button
                type="submit"
                size="small"
                color="error"
                disabled={svc.appointments.length > 0}
                title={
                  svc.appointments.length > 0
                    ? "Não é possível excluir: já existem agendamentos com esse serviço"
                    : undefined
                }
              >
                Excluir
              </Button>
            </form>
          </Stack>
        ))}
      </Paper>

      <Paper elevation={1} sx={{ p: 2.5, maxWidth: 480 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1.5 }}>
          Novo serviço
        </Typography>
        <Stack component="form" action={createServiceAction} spacing={1.5}>
          <ImageUploadField label="Foto (opcional)" shape="rounded" />
          <TextField name="name" label="Nome" size="small" required />
          <Stack direction="row" spacing={1.5}>
            <TextField name="durationMinutes" label="Duração (min)" type="number" size="small" required />
            <TextField name="price" label="Preço (R$)" type="number" size="small" required inputProps={{ step: "0.01" }} />
          </Stack>
          {assetKind && <SizePriceFields kind={assetKind} />}
          <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>
            Adicionar
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
