"use client";

import { useActionState, useState } from "react";
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  Stack,
  Divider,
  MenuItem,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import Link from "next/link";
import { signupAction } from "@/lib/actions/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordPolicy";
import { availableSegments, cap, getSegment, type SegmentSlug } from "@/lib/segments";
import TermsCheckbox from "../TermsCheckbox";

export default function CadastroForm({ initialSegment }: { initialSegment?: SegmentSlug }) {
  const [state, formAction, pending] = useActionState(signupAction, undefined);
  const [segmentSlug, setSegmentSlug] = useState<string>(getSegment(initialSegment).slug);
  const segment = getSegment(segmentSlug);
  const { vocab } = segment;

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
          Criar {vocab.business}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Teste grátis, sem cartão de crédito.
        </Typography>
        <Stack component="form" action={formAction} spacing={2}>
          <TextField
            name="segment"
            select
            label="O que você faz?"
            value={segmentSlug}
            onChange={(e) => setSegmentSlug(e.target.value)}
          >
            {availableSegments().map((seg) => (
              <MenuItem key={seg.slug} value={seg.slug}>
                {seg.emoji} {seg.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField name="salonName" label={`Nome ${vocab.businessGender === "f" ? "da" : "do"} ${vocab.business}`} required autoFocus />
          <FormControlLabel
            control={<Checkbox name="withSampleServices" defaultChecked />}
            label={
              <Typography variant="body2" color="text.secondary">
                Já criar serviços de exemplo ({segment.sampleServices.map((sv) => sv.name).slice(0, 3).join(", ")}…). {cap(vocab.professional)} edita depois.
              </Typography>
            }
          />
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
          <TermsCheckbox />
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
