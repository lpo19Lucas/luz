// Configurações do salão: dados básicos, PIX de recebimento (spec 8.8) e
// confirmação de presença (P0.10) — a única tela hoje que deixa o dono
// mexer nesses dois pontos, que antes só mudavam com acesso direto ao banco.
import { Box, Typography, Paper, Stack, TextField, Button, Switch, FormControlLabel, MenuItem } from "@mui/material";
import { getCurrentSalon } from "@/lib/currentSalon";
import { prisma } from "@/lib/prisma";
import { updateSalonSettings, updatePresenceConfirmationConfig } from "@/lib/actions/salon";
import { isAiDescriptionAvailable } from "@/lib/aiDescription";
import SalonProfileForm from "./SalonProfileForm";
import ChangePasswordForm from "./ChangePasswordForm";

export default async function ConfiguracoesPage() {
  const salon = await getCurrentSalon();
  const presenceCfg = await prisma.presenceConfirmationConfig.findUnique({
    where: { salonId: salon.id },
  });

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 500, mb: 2 }}>
        Configurações
      </Typography>

      <SalonProfileForm
        salon={{
          slug: salon.slug,
          description: salon.description,
          primaryColor: salon.primaryColor,
          accentColor: salon.accentColor,
          whatsappPhone: salon.whatsappPhone,
          email: salon.email,
          cnpj: salon.cnpj,
          instagramUrl: salon.instagramUrl,
          facebookUrl: salon.facebookUrl,
          tiktokUrl: salon.tiktokUrl,
          websiteUrl: salon.websiteUrl,
          addressStreet: salon.addressStreet,
          addressNumber: salon.addressNumber,
          addressComplement: salon.addressComplement,
          addressNeighborhood: salon.addressNeighborhood,
          addressCity: salon.addressCity,
          addressState: salon.addressState,
          addressZip: salon.addressZip,
          hasCover: Boolean(salon.coverImageData),
          coverUrl: salon.coverImageData
            ? `/api/salons/${salon.slug}/cover?v=${salon.coverImageUpdatedAt?.getTime() ?? 0}`
            : null,
          faqJson: Array.isArray(salon.faqJson) ? (salon.faqJson as Array<{ q: string; a: string }>) : [],
        }}
        aiAvailable={isAiDescriptionAvailable()}
      />

      <Paper elevation={1} sx={{ p: 3, maxWidth: 480, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 2 }}>
          Dados do salão
        </Typography>
        <Stack component="form" action={updateSalonSettings} spacing={2}>
          <TextField name="name" label="Nome do salão" defaultValue={salon.name} required size="small" />
          <TextField
            name="pixKey"
            label="Chave PIX do salão (recebimento dos serviços)"
            defaultValue={salon.pixKey ?? ""}
            helperText="Mostrada ao cliente na hora de pagar o serviço — sem gateway, é autodeclarado (spec 8.8)."
            size="small"
          />
          <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>
            Salvar
          </Button>
        </Stack>
      </Paper>

      <Paper elevation={1} sx={{ p: 3, maxWidth: 480 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 0.5 }}>
          Confirmação de presença
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Pede ao cliente pra confirmar presença antes do horário (P0.10).
        </Typography>
        <Stack component="form" action={updatePresenceConfirmationConfig} spacing={2}>
          <FormControlLabel
            control={<Switch name="enabled" defaultChecked={presenceCfg?.enabled ?? true} />}
            label="Habilitada"
          />
          <TextField
            name="hoursBefore"
            label="Horas de antecedência"
            type="number"
            size="small"
            defaultValue={presenceCfg?.hoursBefore ?? 24}
            sx={{ maxWidth: 220 }}
          />
          <TextField
            name="actionOnNoConfirm"
            label="Se o cliente não confirmar"
            select
            size="small"
            defaultValue={presenceCfg?.actionOnNoConfirm ?? "ALERT_ONLY"}
            sx={{ maxWidth: 320 }}
          >
            <MenuItem value="ALERT_ONLY">Só alertar o salão (padrão)</MenuItem>
            <MenuItem value="RELEASE_SLOT">Liberar o horário automaticamente</MenuItem>
          </TextField>
          <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>
            Salvar
          </Button>
        </Stack>
      </Paper>

      <ChangePasswordForm />
    </Box>
  );
}
