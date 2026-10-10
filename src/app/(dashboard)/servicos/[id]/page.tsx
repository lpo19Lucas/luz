import { notFound } from "next/navigation";
import { Box, Typography, Paper, Stack, TextField, Button } from "@mui/material";
import Link from "next/link";
import { getCurrentSalon } from "@/lib/currentSalon";
import { prisma } from "@/lib/prisma";
import { updateServiceAction } from "@/lib/actions/service";
import ImageUploadField from "../../ImageUploadField";
import { storedImageUrl } from "@/lib/storedImages";
import { assetKindForSalon } from "@/lib/clientAssets";
import SizePriceFields from "../SizePriceFields";

export default async function EditarServicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const salon = await getCurrentSalon();

  const service = await prisma.service.findFirst({ where: { id, salonId: salon.id } });
  if (!service) notFound();

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 500, mb: 2 }}>
        Editar serviço
      </Typography>

      <Paper elevation={1} sx={{ p: 2.5, maxWidth: 480 }}>
        <Stack component="form" action={updateServiceAction} spacing={1.5}>
          <input type="hidden" name="id" value={service.id} />
          <ImageUploadField label="Foto" shape="rounded" currentUrl={storedImageUrl(service.imageId)} />
          <TextField name="name" label="Nome" size="small" required defaultValue={service.name} />
          <Stack direction="row" spacing={1.5}>
            <TextField
              name="durationMinutes"
              label="Duração (min)"
              type="number"
              size="small"
              required
              defaultValue={service.durationMinutes}
            />
            <TextField
              name="price"
              label="Preço (R$)"
              type="number"
              size="small"
              required
              inputProps={{ step: "0.01" }}
              defaultValue={(service.priceCents / 100).toFixed(2)}
            />
          </Stack>
          {assetKindForSalon(salon) && <SizePriceFields kind={assetKindForSalon(salon)!} current={service.sizePricesJson} />}
          <Stack direction="row" spacing={1.5}>
            <Button type="submit" variant="contained">
              Salvar
            </Button>
            <Button component={Link} href="/servicos" variant="text">
              Cancelar
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
