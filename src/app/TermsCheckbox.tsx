"use client";

// Aceite dos Termos/Privacidade/Contrato — usado no cadastro e no link de
// convite do cadastro facilitado.
import { FormControlLabel, Checkbox, Typography } from "@mui/material";
import Link from "next/link";

export default function TermsCheckbox() {
  return (
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
  );
}
