"use client";

// Formulários do detalhe do salão no admin que precisam mostrar retorno
// (erro, sucesso, link gerado) — os botões simples ficam em page.tsx.
import { useActionState } from "react";
import { Stack, TextField, Button, Alert, MenuItem } from "@mui/material";
import GeneratedLink from "../../../../GeneratedLink";
import {
  extendTrialAction,
  updateSubscriptionAction,
  updateOwnerAction,
  generateAccessLinkAction,
  type AdminFormState,
} from "@/lib/actions/admin";

function Feedback({ state }: { state: AdminFormState }) {
  if (state?.error) return <Alert severity="error">{state.error}</Alert>;
  if (state?.success && !state.link) return <Alert severity="success">{state.success}</Alert>;
  return null;
}

export function AccessLinkForm({ salonId }: { salonId: string }) {
  const [state, action, pending] = useActionState(generateAccessLinkAction, undefined);
  return (
    <Stack component="form" action={action} spacing={1.5}>
      <input type="hidden" name="salonId" value={salonId} />
      <Button type="submit" variant="outlined" disabled={pending} sx={{ alignSelf: "flex-start" }}>
        {pending ? "Gerando..." : "Gerar link para definir senha"}
      </Button>
      {state?.link && <GeneratedLink link={state.link} whatsappHref={state.whatsappHref} note={state.success} />}
      <Feedback state={state} />
    </Stack>
  );
}

export function ExtendTrialForm({ salonId }: { salonId: string }) {
  const [state, action, pending] = useActionState(extendTrialAction, undefined);
  return (
    <Stack component="form" action={action} spacing={1.5}>
      <input type="hidden" name="salonId" value={salonId} />
      <Stack direction="row" spacing={1}>
        <TextField name="days" type="number" size="small" label="Dias" defaultValue={7} inputProps={{ min: 1, max: 365 }} sx={{ width: 110 }} />
        <Button type="submit" variant="outlined" disabled={pending}>
          Estender teste
        </Button>
      </Stack>
      <Feedback state={state} />
    </Stack>
  );
}

export function SubscriptionEditForm(props: {
  salonId: string;
  plan: string;
  status: string;
  trialEndsAt: string;
  currentPeriodEnd: string;
  plans: { value: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(updateSubscriptionAction, undefined);
  return (
    <Stack component="form" action={action} spacing={1.5}>
      <input type="hidden" name="salonId" value={props.salonId} />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <TextField name="plan" select size="small" label="Plano" defaultValue={props.plan} sx={{ minWidth: 150 }}>
          {props.plans.map((p) => (
            <MenuItem key={p.value} value={p.value}>
              {p.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField name="status" select size="small" label="Status" defaultValue={props.status} sx={{ minWidth: 170 }}>
          <MenuItem value="TRIAL">Em teste</MenuItem>
          <MenuItem value="ACTIVE">Ativa</MenuItem>
          <MenuItem value="PAST_DUE">Pagamento pendente</MenuItem>
          <MenuItem value="CANCELLED">Cancelada</MenuItem>
        </TextField>
      </Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <TextField name="trialEndsAt" type="date" size="small" label="Fim do teste" defaultValue={props.trialEndsAt} InputLabelProps={{ shrink: true }} required />
        <TextField
          name="currentPeriodEnd"
          type="date"
          size="small"
          label="Fim do período pago"
          defaultValue={props.currentPeriodEnd}
          InputLabelProps={{ shrink: true }}
        />
      </Stack>
      <Button type="submit" variant="outlined" disabled={pending} sx={{ alignSelf: "flex-start" }}>
        Salvar ajuste manual
      </Button>
      <Feedback state={state} />
    </Stack>
  );
}

export function OwnerForm(props: { salonId: string; name: string; email: string; phone: string }) {
  const [state, action, pending] = useActionState(updateOwnerAction, undefined);
  return (
    <Stack component="form" action={action} spacing={1.5}>
      <input type="hidden" name="salonId" value={props.salonId} />
      <TextField name="name" size="small" label="Nome" defaultValue={props.name} required />
      <TextField name="email" type="email" size="small" label="E-mail (login)" defaultValue={props.email} required />
      <TextField name="phone" size="small" label="WhatsApp" defaultValue={props.phone} />
      <Button type="submit" variant="outlined" disabled={pending} sx={{ alignSelf: "flex-start" }}>
        Salvar dados do dono
      </Button>
      <Feedback state={state} />
    </Stack>
  );
}
