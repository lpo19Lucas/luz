"use client";

import { useActionState } from "react";
import { Box, Paper, TextField, Button, Typography, Alert, Stack } from "@mui/material";
import Link from "next/link";
import { loginAction } from "@/lib/actions/auth";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
      }}
    >
      <Paper elevation={1} sx={{ p: 4, width: 360 }}>
        <Typography variant="h5" sx={{ fontWeight: 500, mb: 3 }}>
          Entrar
        </Typography>
        <Stack component="form" action={formAction} spacing={2}>
          <TextField name="email" label="E-mail" type="email" required autoFocus />
          <TextField name="password" label="Senha" type="password" required />
          {state?.error && <Alert severity="error">{state.error}</Alert>}
          <Button type="submit" variant="contained" disabled={pending}>
            {pending ? "Entrando..." : "Entrar"}
          </Button>
        </Stack>
        <Typography variant="body2" sx={{ mt: 2.5 }}>
          Ainda não tem conta?{" "}
          <Link href="/cadastro" style={{ color: "inherit" }}>
            Criar salão
          </Link>
        </Typography>
      </Paper>
    </Box>
  );
}
