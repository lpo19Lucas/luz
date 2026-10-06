"use client";

import { useActionState } from "react";
import { Box, Paper, TextField, Button, Typography, Alert, Stack, Divider, FormControlLabel, Checkbox } from "@mui/material";
import Link from "next/link";
import { signupAction } from "@/lib/actions/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordPolicy";

export default function CadastroPage() {
  const [state, formAction, pending] = useActionState(signupAction, undefined);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        py: 4,
        px: 2,
      }}
    >
      <Paper elevation={1} sx={{ p: 4, width: "100%", maxWidth: 400 }}>
        <Typography variant="h5" sx={{ fontWeight: 500, mb: 0.5 }}>
          Criar salão
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Teste grátis, sem cartão de crédito.
        </Typography>
        <Stack component="form" action={formAction} spacing={2}>
          <TextField name="salonName" label="Nome do salão" required autoFocus />
          <Divider />
          <TextField name="name" label="Seu nome" required />
          <TextField name="email" label="E-mail" type="email" required />
          <TextField name="phone" label="WhatsApp (opcional)" type="tel" placeholder="(11) 99999-9999" />
          <TextField
            name="password"
            label="Senha"
            type="password"
            required
            helperText={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
            inputProps={{ minLength: MIN_PASSWORD_LENGTH }}
          />
          <FormControlLabel
            sx={{ alignItems: "flex-start", mr: 0 }}
            control={<Checkbox name="acceptTerms" required sx={{ pt: 0.25 }} />}
            label={
              <Typography variant="body2" color="text.secondary">
                Li e aceito os{" "}
                <Link href="/termos" target="_blank" style={{ color: "inherit", fontWeight: 600 }}>
                  Termos de Uso
                </Link>
                , a{" "}
                <Link href="/privacidade" target="_blank" style={{ color: "inherit", fontWeight: 600 }}>
                  Política de Privacidade
                </Link>{" "}
                e o{" "}
                <Link href="/contrato" target="_blank" style={{ color: "inherit", fontWeight: 600 }}>
                  Contrato de Licença
                </Link>
                .
              </Typography>
            }
          />
          {state?.error && <Alert severity="error">{state.error}</Alert>}
          <Button type="submit" variant="contained" disabled={pending}>
            {pending ? "Criando..." : "Criar minha conta"}
          </Button>
        </Stack>
        <Typography variant="body2" sx={{ mt: 2.5 }}>
          Já tem conta?{" "}
          <Link href="/login" style={{ color: "inherit" }}>
            Entrar
          </Link>
        </Typography>
      </Paper>
    </Box>
  );
}
