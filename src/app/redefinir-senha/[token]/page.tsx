// Link de redefinição de senha ("esqueci minha senha" ou gerado pelo admin) e
// de convite do cadastro facilitado — o mesmo fluxo, com aceite dos termos
// quando a conta ainda não aceitou.
import type { Metadata } from "next";
import { Box, Paper, Typography, Button } from "@mui/material";
import Link from "next/link";
import { findValidPasswordToken, tokenRequiresTerms } from "@/lib/passwordReset";
import ResetPasswordForm from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Definir senha", robots: { index: false } };

export default async function RedefinirSenhaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const record = await findValidPasswordToken(token);

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default", px: 2, py: 4 }}>
      <Paper elevation={1} sx={{ p: 4, width: "100%", maxWidth: 400 }}>
        {record ? (
          <>
            <Typography variant="h5" sx={{ fontWeight: 500, mb: 1 }}>
              {record.purpose === "INVITE" ? "Bem-vindo(a) à Luz!" : "Criar nova senha"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {record.purpose === "INVITE"
                ? `Olá, ${record.user.name}! Defina uma senha para acessar o painel do seu salão (${record.user.email}).`
                : `Conta: ${record.user.email}`}
            </Typography>
            <ResetPasswordForm token={token} requireTerms={tokenRequiresTerms(record)} />
          </>
        ) : (
          <>
            <Typography variant="h5" sx={{ fontWeight: 500, mb: 1 }}>
              Link inválido
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Este link expirou ou já foi usado. Peça um novo para continuar.
            </Typography>
            <Button component={Link} href="/esqueci-senha" variant="contained">
              Pedir novo link
            </Button>
          </>
        )}
      </Paper>
    </Box>
  );
}
