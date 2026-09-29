"use client";

import { useActionState } from "react";
import { Box, Paper, TextField, Button, Typography, Alert, Stack } from "@mui/material";
import { adminLoginAction } from "@/lib/actions/admin";

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(adminLoginAction, undefined);

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
        <Typography variant="h5" sx={{ fontWeight: 500, mb: 1 }}>
          Administração da plataforma
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Acesso restrito — conciliação manual de assinaturas.
        </Typography>
        <Stack component="form" action={formAction} spacing={2}>
          <TextField name="password" label="Senha" type="password" required autoFocus />
          {state?.error && <Alert severity="error">{state.error}</Alert>}
          <Button type="submit" variant="contained" disabled={pending}>
            {pending ? "Entrando..." : "Entrar"}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
