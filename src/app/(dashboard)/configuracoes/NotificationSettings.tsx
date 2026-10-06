"use client";

import { useActionState } from "react";
import { Paper, Typography, Button, Alert, Stack } from "@mui/material";
import EnableNotifications from "../../EnableNotifications";
import { sendTestNotificationAction } from "@/lib/actions/notifications";

export default function NotificationSettings() {
  const [state, action, pending] = useActionState(sendTestNotificationAction, undefined);
  return (
    <Paper elevation={1} sx={{ p: 3, maxWidth: 560, mb: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 0.5 }}>
        Notificações
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Receba no celular ou no computador os novos agendamentos, cancelamentos e o resumo do dia. Ative em cada
        aparelho que você usa.
      </Typography>
      <Stack spacing={2}>
        <EnableNotifications title="Este aparelho" />
        <form action={action}>
          <Button type="submit" variant="outlined" size="small" disabled={pending}>
            {pending ? "Enviando..." : "Enviar notificação de teste"}
          </Button>
        </form>
        {state?.success && <Alert severity="success">{state.success}</Alert>}
        {state?.error && <Alert severity="info">{state.error}</Alert>}
      </Stack>
    </Paper>
  );
}
