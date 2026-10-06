"use client";

import { useActionState } from "react";
import { Paper, Stack, TextField, Button, Alert, Typography, FormControlLabel, Switch } from "@mui/material";
import { updatePlatformPlanAction } from "@/lib/actions/admin";

export type PlanFormValues = {
  plan: string;
  label: string;
  price: string;
  durationDays: number;
  description: string;
  active: boolean;
  preview: string;
};

export default function PlanForm({ values }: { values: PlanFormValues }) {
  const [state, action, pending] = useActionState(updatePlatformPlanAction, undefined);
  const isTrial = values.plan === "TRIAL";

  return (
    <Paper elevation={1} sx={{ p: 2.5 }}>
      <Typography variant="overline" color="text.secondary">
        {isTrial ? "Teste grátis (novos cadastros)" : `Plano ${values.plan}`}
      </Typography>
      <Stack component="form" action={action} spacing={1.75} sx={{ mt: 1 }}>
        <input type="hidden" name="plan" value={values.plan} />
        <TextField name="label" size="small" label="Nome" defaultValue={values.label} required />
        <Stack direction="row" spacing={1.5}>
          {!isTrial && (
            <TextField
              name="price"
              size="small"
              label="Preço do período (R$)"
              defaultValue={values.price}
              inputProps={{ inputMode: "decimal" }}
              required
              sx={{ flex: 1 }}
            />
          )}
          <TextField
            name="durationDays"
            type="number"
            size="small"
            label={isTrial ? "Dias de teste" : "Duração (dias)"}
            defaultValue={values.durationDays}
            inputProps={{ min: 1, max: 3650 }}
            required
            sx={{ flex: 1 }}
          />
        </Stack>
        {!isTrial && (
          <>
            <TextField
              name="description"
              size="small"
              label="Texto embaixo do preço (opcional)"
              defaultValue={values.description}
              helperText={`Vazio = automático: "${values.preview}"`}
            />
            <FormControlLabel control={<Switch name="active" defaultChecked={values.active} />} label="À venda (landing e tela de assinatura)" />
          </>
        )}
        {isTrial && <input type="hidden" name="active" value="on" />}
        {state?.error && <Alert severity="error">{state.error}</Alert>}
        {state?.success && <Alert severity="success">{state.success}</Alert>}
        <Button type="submit" variant="outlined" disabled={pending} sx={{ alignSelf: "flex-start" }}>
          Salvar
        </Button>
      </Stack>
    </Paper>
  );
}
