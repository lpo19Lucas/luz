// Conta do profissional: app instalável, notificações e senha.
import { Box, Typography } from "@mui/material";
import { getCurrentProfessional } from "@/lib/currentSalon";
import InstallAppPrompt from "../../InstallAppPrompt";
import NotificationSettings from "../../(dashboard)/configuracoes/NotificationSettings";
import ChangePasswordForm from "../../(dashboard)/configuracoes/ChangePasswordForm";

export default async function MinhaContaPage() {
  await getCurrentProfessional();
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        Minha conta
      </Typography>
      <Box sx={{ mb: 3, maxWidth: 560 }}>
        <InstallAppPrompt appName="Luz" description="Sua agenda na tela inicial do celular, como um aplicativo." />
      </Box>
      <NotificationSettings />
      <ChangePasswordForm />
    </Box>
  );
}
