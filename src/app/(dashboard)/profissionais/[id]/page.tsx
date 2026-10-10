import { notFound } from "next/navigation";
import { Box, Typography, Paper, Stack, TextField, Button, FormControlLabel, Checkbox } from "@mui/material";
import Link from "next/link";
import { getCurrentSalon } from "@/lib/currentSalon";
import { prisma } from "@/lib/prisma";
import { updateProfessionalAction } from "@/lib/actions/professional";
import { AvailabilityFields } from "../AvailabilityFields";
import ImageUploadField from "../../ImageUploadField";
import ProfessionalAccess from "./ProfessionalAccess";
import { storedImageUrl } from "@/lib/storedImages";
import { getSegment, cap, businessOf, grammar } from "@/lib/segments";

export default async function EditarProfissionalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const salon = await getCurrentSalon();
  const vocab = getSegment(salon.segment).vocab;
  const apptG = grammar(vocab.appointmentGender);

  const professional = await prisma.professional.findFirst({
    where: { id, salonId: salon.id },
    include: {
      availability: true,
      services: true,
      user: { select: { email: true, termsVersion: true, passwordResetTokens: { where: { usedAt: { not: null } }, take: 1, select: { id: true } } } },
    },
  });
  if (!professional) notFound();

  const services = await prisma.service.findMany({ where: { salonId: salon.id }, orderBy: { name: "asc" } });

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 500, mb: 2 }}>
        Editar {vocab.professional}
      </Typography>

      <Paper elevation={1} sx={{ p: 2.5, maxWidth: 520 }}>
        <Stack component="form" action={updateProfessionalAction} spacing={2}>
          <input type="hidden" name="id" value={professional.id} />
          <ImageUploadField
            label="Foto"
            currentUrl={storedImageUrl(professional.photoImageId)}
            fallback={professional.name.charAt(0).toUpperCase()}
          />
          <TextField name="name" label="Nome" size="small" fullWidth required defaultValue={professional.name} />
          <TextField
            name="commissionPercent"
            label="Comissão (%)"
            type="number"
            size="small"
            fullWidth
            inputProps={{ min: 0, max: 100, step: "0.1" }}
            defaultValue={professional.commissionPercent ?? ""}
            helperText="Opcional — usado no relatório de Comissões"
          />
          <FormControlLabel
            control={<Checkbox name="active" defaultChecked={professional.active} />}
            label="Ativo (aparece na agenda de agendamento pública)"
          />
          <AvailabilityFields
            professionalWord={vocab.professional}
            services={services}
            existingAvailability={professional.availability}
            existingServiceIds={professional.services.map((s) => s.serviceId)}
          />
          <Stack direction="row" spacing={1.5}>
            <Button type="submit" variant="contained">
              Salvar
            </Button>
            <Button component={Link} href="/profissionais" variant="text">
              Cancelar
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <ProfessionalAccess
        professionalId={professional.id}
        professionalName={professional.name}
        professionalWord={vocab.professional}
        phone={professional.phone}
        access={
          professional.user
            ? {
                email: professional.user.email,
                // Ativo = já definiu a senha (usou um link) ou já tinha conta com termos aceitos.
                activated: professional.user.passwordResetTokens.length > 0 || professional.user.termsVersion !== null,
              }
            : null
        }
      />
    </Box>
  );
}
