"use client";

import { useActionState } from "react";
import { Paper, Typography, Button, Alert, Stack, FormControlLabel, Checkbox, Divider } from "@mui/material";
import EnableNotifications from "../../EnableNotifications";
import { sendTestNotificationAction, saveNotificationPrefsAction } from "@/lib/actions/notifications";
import { STAFF_NOTIFICATION_TYPES } from "@/lib/notificationTypes";

export default function NotificationSettings({ role, muted }: { role: "OWNER" | "PROFESSIONAL"; muted: string[] }) {
  const [testState, testAction, testing] = useActionState(sendTestNotificationAction, undefined);
  const [prefsState, prefsAction, saving] = useActionState(saveNotificationPrefsAction, undefined);
  const types = STAFF_NOTIFICATION_TYPES.filter((t) => role === "OWNER" || !t.ownerOnly);

  return (
    <Paper elevation={1} sx={{ p: 3, maxWidth: 560, mb: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 0.5 }}>
        Notificações
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {role === "OWNER"
          ? "Receba no celular ou no computador os novos agendamentos, cancelamentos e o resumo do dia. Ative em cada aparelho que você usa."
          : "Receba no celular os seus agendamentos, cancelamentos e o resumo do dia."}
      </Typography>
      <Stack spacing={2}>
        <EnableNotifications title="Este aparelho" />
        <form action={testAction}>
          <Button type="submit" variant="outlined" size="small" disabled={testing}>
            {testing ? "Enviando..." : "Enviar notificação de teste"}
          </Button>
        </form>
        {testState?.success && <Alert severity="success">{testState.success}</Alert>}
        {testState?.error && <Alert severity="info">{testState.error}</Alert>}

        <Divider />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          O que você quer receber
        </Typography>
        <Stack component="form" action={prefsAction} spacing={0.5}>
          {types.map((t) => (
            <FormControlLabel
              key={t.type}
              control={<Checkbox name="enabled" value={t.type} defaultChecked={!muted.includes(t.type)} size="small" />}
              label={<Typography variant="body2">{t.label}</Typography>}
            />
          ))}
          <Button type="submit" variant="outlined" size="small" disabled={saving} sx={{ alignSelf: "flex-start", mt: 1 }}>
            Salvar preferências
          </Button>
          {prefsState?.success && <Alert severity="success" sx={{ mt: 1 }}>{prefsState.success}</Alert>}
        </Stack>
      </Stack>
    </Paper>
  );
}
