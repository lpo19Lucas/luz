"use client";

import { useActionState, useState } from "react";
import { Paper, Stack, TextField, Button, Alert, MenuItem, Typography, Divider, Checkbox, FormControlLabel } from "@mui/material";
import Link from "next/link";
import { createSalonAction } from "@/lib/actions/admin";
import { DEFAULT_SEGMENT, availableSegments } from "@/lib/segments";
import GeneratedLink from "../../../../GeneratedLink";

export default function NewSalonForm({ plans, trialDays }: { plans: { value: string; label: string }[]; trialDays: number }) {
  const [state, action, pending] = useActionState(createSalonAction, undefined);
  const [plan, setPlan] = useState("TRIAL");

  if (state?.salonId && state.link) {
    return (
      <Paper elevation={1} sx={{ p: 3, maxWidth: 620 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
          {state.success}
        </Typography>
        <GeneratedLink
          link={state.link}
          whatsappHref={state.whatsappHref}
          note="Convite para o dono criar a senha e aceitar os termos (vale 7 dias):"
        />
        <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
          <Button component={Link} href={`/admin/saloes/${state.salonId}`} variant="contained">
            Abrir o salão
          </Button>
          <Button component="a" href="/admin/saloes/novo">
            Cadastrar outro
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper elevation={1} sx={{ p: 3, maxWidth: 620 }}>
      <Stack component="form" action={action} spacing={2}>
        <TextField name="salonName" label="Nome do salão" required autoFocus />
        <Divider />
        <TextField name="ownerName" label="Nome do dono" required />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField name="email" type="email" label="E-mail do dono (login)" required sx={{ flex: 1 }} />
          <TextField name="phone" label="WhatsApp do dono" placeholder="(11) 99999-9999" sx={{ flex: 1 }} helperText="Pra enviar o convite" />
        </Stack>
        <Divider />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField name="plan" select label="Plano" value={plan} onChange={(e) => setPlan(e.target.value)} sx={{ flex: 1 }}>
            {plans.map((p) => (
              <MenuItem key={p.value} value={p.value}>
                {p.value === "TRIAL" ? `${p.label} (${trialDays} dias)` : `${p.label} — já ativo`}
              </MenuItem>
            ))}
          </TextField>
          {plan === "TRIAL" && (
            <TextField
              name="trialDays"
              type="number"
              label="Dias de teste"
              defaultValue={trialDays}
              inputProps={{ min: 1, max: 365 }}
              sx={{ width: { sm: 160 } }}
            />
          )}
        </Stack>
        <TextField name="segment" select label="Segmento" defaultValue={DEFAULT_SEGMENT}>
          {availableSegments().map((seg) => (
            <MenuItem key={seg.slug} value={seg.slug}>
              {seg.emoji} {seg.label}
            </MenuItem>
          ))}
        </TextField>
        <FormControlLabel
          control={<Checkbox name="withSampleServices" defaultChecked />}
          label="Criar os serviços de exemplo do segmento (o dono edita depois)"
        />
        <Typography variant="body2" color="text.secondary">
          A conta nasce sem senha: você recebe um link de convite pra mandar ao dono, que define a senha e aceita os
          termos no primeiro acesso. Plano pago já nasce ativo (use depois de conferir o PIX).
        </Typography>
        {state?.error && <Alert severity="error">{state.error}</Alert>}
        <Button type="submit" variant="contained" disabled={pending} sx={{ alignSelf: "flex-start" }}>
          {pending ? "Criando..." : "Criar salão e gerar convite"}
        </Button>
      </Stack>
    </Paper>
  );
}
