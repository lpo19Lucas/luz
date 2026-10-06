// Planos da plataforma: preço, duração, texto e quais estão à venda, mais os
// dias de teste grátis. A landing e /assinatura leem daqui.
import { Box, Typography } from "@mui/material";
import { getPlatformPlans, describePlan, formatBRL } from "@/lib/plans";
import PlanForm from "./PlanForm";

export const dynamic = "force-dynamic";

export default async function PlanosPage() {
  const plans = await getPlatformPlans();
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
        Planos
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Mudanças valem para novas ativações e renovações — quem já está num período pago continua até o vencimento. A
        landing atualiza em até 5 minutos.
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        {plans.map((p) => (
          <PlanForm
            key={p.plan}
            values={{
              plan: p.plan,
              label: p.label,
              price: (p.priceCents / 100).toFixed(2).replace(".", ","),
              durationDays: p.durationDays,
              description: p.description ?? "",
              active: p.active,
              preview: `${describePlan({ ...p, description: null })} · ${formatBRL(p.pricePerMonthCents)}/mês`,
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
