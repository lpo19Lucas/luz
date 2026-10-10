// Agendamento manual pelo dono (B3) — mesmo fluxo de escolher
// profissional/serviço/horário do cliente, mas com um "encaixe livre" pra
// quando o cliente liga ou chega no balcão fora da grade de horários.
import { Box, Typography, Stack, Button } from "@mui/material";
import Link from "next/link";
import { getCurrentSalon } from "@/lib/currentSalon";
import { prisma } from "@/lib/prisma";
import NewAppointmentForm from "./NewAppointmentForm";
import { assetKindForSalon } from "@/lib/clientAssets";

export default async function NovoAgendamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ professionalId?: string; date?: string }>;
}) {
  const { professionalId, date } = await searchParams;
  const salon = await getCurrentSalon();

  const [professionals, services] = await Promise.all([
    prisma.professional.findMany({
      where: { salonId: salon.id, active: true },
      include: { services: { select: { serviceId: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.service.findMany({ where: { salonId: salon.id }, orderBy: { name: "asc" } }),
  ]);

  return (
    <Box sx={{ maxWidth: 520 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 500 }}>
          Novo agendamento
        </Typography>
        <Button component={Link} href="/agenda" size="small">
          ← Voltar pra agenda
        </Button>
      </Stack>

      {professionals.length === 0 || services.length === 0 ? (
        <Typography color="text.secondary">
          Cadastre pelo menos um profissional e um serviço antes de agendar.
        </Typography>
      ) : (
        <NewAppointmentForm
          salonSlug={salon.slug}
          professionals={professionals.map((p) => ({
            id: p.id,
            name: p.name,
            serviceIds: p.services.map((s) => s.serviceId),
          }))}
          services={services.map((s) => ({
            id: s.id,
            name: s.name,
            durationMinutes: s.durationMinutes,
            priceCents: s.priceCents,
          }))}
          initialProfessionalId={professionalId}
          initialDate={date}
          assetKind={assetKindForSalon(salon)}
        />
      )}
    </Box>
  );
}
