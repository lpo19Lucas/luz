// CRUD de profissionais + disponibilidade (spec P0.2, P0.3, P0.18).
// Referência visual: mui-exemplos.html (Exemplo 4).
import { Box, Typography, Paper, Stack, Chip, TextField, Button, Avatar } from "@mui/material";
import Link from "next/link";
import { getCurrentSalon } from "@/lib/currentSalon";
import { prisma } from "@/lib/prisma";
import { createProfessionalAction, deleteProfessionalAction } from "@/lib/actions/professional";
import { AvailabilityFields } from "./AvailabilityFields";
import ImageUploadField from "../ImageUploadField";
import { storedImageUrl } from "@/lib/storedImages";
import { getSegment } from "@/lib/segments";

export default async function ProfissionaisPage() {
  const salon = await getCurrentSalon();
  const { vocab } = getSegment(salon.segment);
  const professionals = await prisma.professional.findMany({
    where: { salonId: salon.id },
    include: { services: true, appointments: { select: { id: true }, take: 1 } },
    orderBy: { name: "asc" },
  });
  const services = await prisma.service.findMany({ where: { salonId: salon.id }, orderBy: { name: "asc" } });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 500 }}>
          {professionals.length} {professionals.length === 1 ? vocab.professional : vocab.professionals} cadastrado(s)
        </Typography>
      </Stack>

      <Paper elevation={1} sx={{ mb: 3 }}>
        {professionals.length === 0 && (
          <Typography sx={{ p: 2 }} color="text.secondary">
            Ninguém cadastrado ainda.
          </Typography>
        )}
        {professionals.map((prof) => (
          <Stack
            key={prof.id}
            direction="row"
            alignItems="center"
            spacing={2}
            sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}
          >
            <Avatar src={storedImageUrl(prof.photoImageId) ?? undefined} alt={prof.name} sx={{ bgcolor: "primary.main", width: 40, height: 40, fontSize: 14 }}>
              {prof.name.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography>{prof.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {prof.services.length} serviço(s)
              </Typography>
            </Box>
            <Chip
              label={prof.active ? "ATIVO" : "INATIVO"}
              color={prof.active ? "success" : "default"}
              size="small"
            />
            <Button component={Link} href={`/profissionais/${prof.id}`} size="small">
              Editar
            </Button>
            <form action={deleteProfessionalAction}>
              <input type="hidden" name="id" value={prof.id} />
              <Button type="submit" size="small" color="error">
                {prof.appointments.length > 0 ? "Inativar" : "Excluir"}
              </Button>
            </form>
          </Stack>
        ))}
      </Paper>

      <Paper elevation={1} sx={{ p: 2.5, maxWidth: 520 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1.5 }}>
          Novo profissional
        </Typography>
        <Stack component="form" action={createProfessionalAction} spacing={2}>
          <ImageUploadField label="Foto (opcional)" />
          <TextField name="name" label="Nome" size="small" fullWidth required />
          <TextField
            name="commissionPercent"
            label="Comissão (%)"
            type="number"
            size="small"
            fullWidth
            inputProps={{ min: 0, max: 100, step: "0.1" }}
            helperText="Opcional — usado no relatório de Comissões"
          />
          <AvailabilityFields services={services} />
          <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>
            Adicionar
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
