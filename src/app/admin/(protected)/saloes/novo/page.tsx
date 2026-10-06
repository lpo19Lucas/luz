// Cadastro facilitado: o admin cria o salão pelo dono e manda o convite.
import { Box, Typography } from "@mui/material";
import { getPlatformPlans, getTrialDays } from "@/lib/plans";
import NewSalonForm from "./NewSalonForm";

export const dynamic = "force-dynamic";

export default async function NovoSalaoPage() {
  const [plans, trialDays] = await Promise.all([getPlatformPlans(), getTrialDays()]);
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        Novo salão
      </Typography>
      <NewSalonForm plans={plans.map((p) => ({ value: p.plan, label: p.label }))} trialDays={trialDays} />
    </Box>
  );
}
