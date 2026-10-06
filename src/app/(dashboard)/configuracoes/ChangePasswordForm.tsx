"use client";

import { useActionState, useEffect, useRef } from "react";
import { Paper, Typography, Stack, TextField, Button, Alert } from "@mui/material";
import { changePasswordAction } from "@/lib/actions/password";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordPolicy";

export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <Paper elevation={1} sx={{ p: 3, maxWidth: 560, mb: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 2 }}>
        Alterar senha
      </Typography>
      <Stack component="form" ref={formRef} action={formAction} spacing={2}>
        <TextField name="currentPassword" label="Senha atual" type="password" size="small" required />
        <TextField
          name="newPassword"
          label="Nova senha"
          type="password"
          size="small"
          required
          helperText={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
          inputProps={{ minLength: MIN_PASSWORD_LENGTH }}
        />
        <TextField name="confirmation" label="Repita a nova senha" type="password" size="small" required />
        {state?.error && <Alert severity="error">{state.error}</Alert>}
        {state?.success && <Alert severity="success">{state.success}</Alert>}
        <Button type="submit" variant="contained" disabled={pending} sx={{ alignSelf: "flex-start" }}>
          {pending ? "Salvando..." : "Alterar senha"}
        </Button>
      </Stack>
    </Paper>
  );
}
