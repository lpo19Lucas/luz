// Pacotes/assinaturas de cliente: o "cardápio" de pacotes à venda do salão
// (vendidos manualmente em /clientes/[id] ou reservados pelo cliente na
// página pública — sempre sem gateway de pagamento).
import { Box, Typography, Paper, Stack, TextField, Button, MenuItem, Chip } from "@mui/material";
import { getCurrentSalon } from "@/lib/currentSalon";
import { prisma } from "@/lib/prisma";
import { createPackageDefinitionAction, togglePackageDefinitionActiveAction } from "@/lib/actions/package";

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function PacotesPage() {
  const salon = await getCurrentSalon();
  const [definitions, services] = await Promise.all([
    prisma.packageDefinition.findMany({
      where: { salonId: salon.id },
      include: { service: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.service.findMany({ where: { salonId: salon.id }, orderBy: { name: "asc" } }),
  ]);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 500, mb: 2 }}>
        {definitions.length} pacote(s) cadastrado(s)
      </Typography>

      <Paper elevation={1} sx={{ mb: 3 }}>
        {definitions.length === 0 && (
          <Typography sx={{ p: 2 }} color="text.secondary">
            Nenhum pacote ainda.
          </Typography>
        )}
        {definitions.map((def) => (
          <Stack
            key={def.id}
            direction="row"
            alignItems="center"
            spacing={1.5}
            sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}
          >
            <Box sx={{ flexGrow: 1 }}>
              <Typography sx={{ fontWeight: 500 }}>{def.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {def.type === "SERVICE_CREDITS"
                  ? `${def.credits} usos de ${def.service?.name ?? "serviço removido"}`
                  : `Crédito de ${formatPrice(def.valueCents ?? 0)}`}{" "}
                · válido {def.validityDays} dias
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 700, color: "secondary.main" }}>{formatPrice(def.priceCents)}</Typography>
            <Chip label={def.active ? "À venda" : "Inativo"} color={def.active ? "success" : "default"} size="small" />
            <form action={togglePackageDefinitionActiveAction}>
              <input type="hidden" name="id" value={def.id} />
              <Button type="submit" size="small">
                {def.active ? "Desativar" : "Reativar"}
              </Button>
            </form>
          </Stack>
        ))}
      </Paper>

      <Paper elevation={1} sx={{ p: 2.5, maxWidth: 480 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1.5 }}>
          Novo pacote
        </Typography>
        {services.length === 0 ? (
          <Typography color="text.secondary" variant="body2">
            Cadastre um serviço primeiro pra poder criar um pacote de créditos por serviço (ou crie um pacote de
            crédito em R$, que não depende de serviço).
          </Typography>
        ) : null}
        <Stack component="form" action={createPackageDefinitionAction} spacing={1.5}>
          <TextField name="name" label="Nome" size="small" required placeholder="Ex: 4 cortes no mês" />
          <TextField name="type" label="Tipo" size="small" required select defaultValue="SERVICE_CREDITS">
            <MenuItem value="SERVICE_CREDITS">Créditos de 1 serviço</MenuItem>
            <MenuItem value="CASH_CREDIT">Crédito em R$ (qualquer serviço)</MenuItem>
          </TextField>
          <TextField name="serviceId" label="Serviço (se for créditos por serviço)" size="small" select defaultValue="">
            <MenuItem value="">—</MenuItem>
            {services.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1.5}>
            <TextField name="credits" label="Créditos (se por serviço)" type="number" size="small" fullWidth />
            <TextField name="value" label="Valor do crédito em R$ (se genérico)" type="number" size="small" fullWidth inputProps={{ step: "0.01" }} />
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <TextField name="price" label="Preço de venda (R$)" type="number" size="small" required fullWidth inputProps={{ step: "0.01" }} />
            <TextField name="validityDays" label="Validade (dias)" type="number" size="small" required fullWidth />
          </Stack>
          <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>
            Adicionar
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
