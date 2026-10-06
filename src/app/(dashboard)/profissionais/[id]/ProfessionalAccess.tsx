"use client";

// Fase P: o dono dá acesso ao profissional (conta própria, vê só a própria
// agenda e recebe as próprias notificações), reenvia o link ou tira o acesso.
import { useActionState } from "react";
import { Paper, Typography, Stack, TextField, Button, Alert, Chip } from "@mui/material";
import {
  grantProfessionalAccessAction,
  resendProfessionalLinkAction,
  revokeProfessionalAccessAction,
  type AccessFormState,
} from "@/lib/actions/professional";
import GeneratedLink from "../../../GeneratedLink";

function Result({ state }: { state: AccessFormState }) {
  if (state?.link) return <GeneratedLink link={state.link} whatsappHref={state.whatsappHref} note={state.success} />;
  if (state?.error) return <Alert severity="error">{state.error}</Alert>;
  return null;
}

export default function ProfessionalAccess({
  professionalId,
  professionalName,
  access,
  phone,
}: {
  professionalId: string;
  professionalName: string;
  access: { email: string; activated: boolean } | null;
  phone: string | null;
}) {
  const [grantState, grant, granting] = useActionState(grantProfessionalAccessAction, undefined);
  const [resendState, resend, resending] = useActionState(resendProfessionalLinkAction, undefined);

  return (
    <Paper elevation={1} sx={{ p: 2.5, maxWidth: 520, mt: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 0.5 }}>
        Acesso do profissional
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Com acesso, {professionalName} entra com e-mail e senha próprios, vê só a própria agenda, marca atendimentos
        como concluídos e recebe os próprios agendamentos no celular. Não vê clientes, valores nem configurações do
        salão.
      </Typography>

      {access ? (
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
            <Typography variant="body2">{access.email}</Typography>
            <Chip size="small" color={access.activated ? "success" : "warning"} label={access.activated ? "Acesso ativo" : "Convite pendente"} />
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            <form action={resend}>
              <input type="hidden" name="professionalId" value={professionalId} />
              <Button type="submit" size="small" variant="outlined" disabled={resending}>
                {access.activated ? "Gerar link de nova senha" : "Gerar novo convite"}
              </Button>
            </form>
            <form action={revokeProfessionalAccessAction}>
              <input type="hidden" name="professionalId" value={professionalId} />
              <Button type="submit" size="small" color="error">
                Tirar acesso
              </Button>
            </form>
          </Stack>
          <Result state={resendState} />
          <Result state={grantState} />
        </Stack>
      ) : (
        <Stack component="form" action={grant} spacing={1.5}>
          <input type="hidden" name="professionalId" value={professionalId} />
          <TextField name="email" type="email" size="small" label="E-mail do profissional" required />
          <TextField name="phone" size="small" label="WhatsApp (pra enviar o convite)" defaultValue={phone ?? ""} />
          <Button type="submit" variant="contained" disabled={granting} sx={{ alignSelf: "flex-start" }}>
            {granting ? "Criando..." : "Dar acesso e gerar convite"}
          </Button>
          <Result state={grantState} />
        </Stack>
      )}
    </Paper>
  );
}
