"use client";

import { useActionState } from "react";
import { TextField, Button, Alert, Stack } from "@mui/material";
import { resetPasswordAction } from "@/lib/actions/password";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordPolicy";
import TermsCheckbox from "../../TermsCheckbox";

export default function ResetPasswordForm({ token, requireTerms }: { token: string; requireTerms: boolean }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, undefined);

  return (
    <Stack component="form" action={formAction} spacing={2}>
      <input type="hidden" name="token" value={token} />
      <TextField
        name="password"
        label="Nova senha"
        type="password"
        required
        autoFocus
        helperText={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
        inputProps={{ minLength: MIN_PASSWORD_LENGTH }}
      />
      <TextField name="confirmation" label="Repita a nova senha" type="password" required inputProps={{ minLength: MIN_PASSWORD_LENGTH }} />
      {requireTerms && <TermsCheckbox />}
      {state?.error && <Alert severity="error">{state.error}</Alert>}
      <Button type="submit" variant="contained" disabled={pending}>
        {pending ? "Salvando..." : "Salvar senha e entrar"}
      </Button>
    </Stack>
  );
}
