"use client";

import { useActionState } from "react";
import { Box, Paper, TextField, Button, Typography, Alert, Stack } from "@mui/material";
import Link from "next/link";
import { requestPasswordResetAction } from "@/lib/actions/password";
import BrandLogo from "@/components/BrandLogo";

export default function EsqueciSenhaPage() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, undefined);

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default", px: 2 }}>
      <Paper elevation={1} sx={{ p: 4, width: "100%", maxWidth: 380 }}>
        <Box sx={{ mb: 2.5 }}><BrandLogo size={40} /></Box>
        <Typography variant="h5" sx={{ fontWeight: 500, mb: 1 }}>
          Esqueci minha senha
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Informe o e-mail da conta. Vamos enviar um link para você criar uma nova senha.
        </Typography>
        {state?.success ? (
          <Alert severity="success">{state.success}</Alert>
        ) : (
          <Stack component="form" action={formAction} spacing={2}>
            <TextField name="email" label="E-mail" type="email" required autoFocus />
            {state?.error && <Alert severity="error">{state.error}</Alert>}
            <Button type="submit" variant="contained" disabled={pending}>
              {pending ? "Enviando..." : "Enviar link"}
            </Button>
          </Stack>
        )}
        <Typography variant="body2" sx={{ mt: 2.5 }}>
          <Link href="/login" style={{ color: "inherit" }}>
            Voltar para o login
          </Link>
        </Typography>
      </Paper>
    </Box>
  );
}
