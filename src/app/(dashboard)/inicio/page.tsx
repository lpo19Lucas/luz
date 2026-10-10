// F12: onboarding guiado — checklist até o link público abrir pros clientes.
// Sem isso, um salão recém-criado mostrava uma página pública vazia, sem
// nenhum horário (porque não tinha profissional nem serviço), e o cliente
// não entendia que o salão só "não estava pronto ainda".
import { Box, Typography, Paper, Stack, Chip, Button, Alert } from "@mui/material";
import Link from "next/link";
import { getCurrentSalon } from "@/lib/currentSalon";
import { prisma } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/appUrl";
import { publishSalonAction } from "@/lib/actions/salon";
import ShareLinkButton from "./ShareLinkButton";
import InstallAppPrompt from "../../InstallAppPrompt";
import { getSegment, cap, businessOf, grammar } from "@/lib/segments";

export default async function InicioPage() {
  const salon = await getCurrentSalon();
  const vocab = getSegment(salon.segment).vocab;
  const apptG = grammar(vocab.appointmentGender);

  const [servicesCount, professionals] = await Promise.all([
    prisma.service.count({ where: { salonId: salon.id } }),
    prisma.professional.findMany({
      where: { salonId: salon.id, active: true },
      include: {
        availability: { select: { id: true }, take: 1 },
        services: { select: { serviceId: true }, take: 1 },
      },
    }),
  ]);

  const hasReadyProfessional = professionals.some(
    (p) => p.availability.length > 0 && p.services.length > 0
  );

  const checklist = [
    { label: `Dados ${businessOf(vocab)} cadastrados`, done: true },
    { label: "Pelo menos 1 serviço cadastrado", done: servicesCount > 0 },
    {
      label: `Pelo menos 1 ${vocab.professional} ativo, com horário e serviço vinculado`,
      done: hasReadyProfessional,
    },
  ];

  const ready = checklist.every((item) => item.done);
  const publicUrl = absoluteUrl(`/${salon.slug}`);

  return (
    <Box sx={{ maxWidth: 560 }}>
      <Typography variant="h5" sx={{ fontWeight: 500, mb: 2 }}>
        Primeiros passos
      </Typography>

      <Box sx={{ mb: 2 }}>
        <InstallAppPrompt
          appName="DLJ Innovations"
          description="Sua agenda na tela inicial do celular, com aviso de cada novo agendamento."
        />
      </Box>

      {salon.publishedAt ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          Seu link já está publicado e aberto para {vocab.clients}.
        </Alert>
      ) : (
        <Alert severity="info" sx={{ mb: 2 }}>
          Complete os itens abaixo e publique seu link pra começar a receber agendamentos.
        </Alert>
      )}

      <Paper elevation={1} sx={{ p: 2.5, mb: 3 }}>
        <Stack spacing={1.5}>
          {checklist.map((item) => (
            <Stack key={item.label} direction="row" spacing={1.5} alignItems="center">
              <Chip
                label={item.done ? "Feito" : "Pendente"}
                color={item.done ? "success" : "default"}
                size="small"
              />
              <Typography variant="body2">{item.label}</Typography>
            </Stack>
          ))}
        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ mt: 2.5 }}>
          <Button component={Link} href="/servicos" size="small" variant="outlined">
            Ir pra Serviços
          </Button>
          <Button component={Link} href="/profissionais" size="small" variant="outlined">
            Ir pra {cap(vocab.professionals)}
          </Button>
        </Stack>
      </Paper>

      <Paper elevation={1} sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1.5 }}>
          Seu link
        </Typography>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2, flexWrap: "wrap" }}>
          <Typography
            component="a"
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            variant="body2"
            sx={{ wordBreak: "break-all" }}
          >
            {publicUrl}
          </Typography>
          <ShareLinkButton url={publicUrl} />
        </Stack>

        {salon.publishedAt ? (
          <Typography variant="body2" color="text.secondary">
            Publicado. Pode continuar editando serviços e {vocab.professionals} a qualquer momento.
          </Typography>
        ) : (
          <form action={publishSalonAction}>
            <Button type="submit" variant="contained" disabled={!ready}>
              Publicar meu link
            </Button>
            {!ready && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                Complete os itens pendentes acima pra poder publicar.
              </Typography>
            )}
          </form>
        )}
      </Paper>
    </Box>
  );
}
