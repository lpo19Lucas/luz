// CRUD de profissionais + disponibilidade (spec P0.2, P0.3, P0.18).
// Referência visual: mui-exemplos.html (Exemplo 4).
import { Box, Typography, Paper, Stack, Chip, TextField, Button, Avatar } from "@mui/material";
import { revalidatePath } from "next/cache";
import { getCurrentSalon } from "@/lib/currentSalon";
import { prisma } from "@/lib/prisma";

async function createProfessional(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const salon = await getCurrentSalon();
  await prisma.professional.create({ data: { salonId: salon.id, name } });
  revalidatePath("/profissionais");
}

export default async function ProfissionaisPage() {
  const salon = await getCurrentSalon();
  const professionals = await prisma.professional.findMany({
    where: { salonId: salon.id },
    orderBy: { name: "asc" },
  });

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 500 }}>
          {professionals.length} profissional(is) cadastrado(s)
        </Typography>
      </Stack>

      <Paper elevation={1} sx={{ mb: 3 }}>
        {professionals.length === 0 && (
          <Typography sx={{ p: 2 }} color="text.secondary">
            Nenhum profissional ainda.
          </Typography>
        )}
        {professionals.map((prof) => (
          <Stack
            key={prof.id}
            direction="row"
            alignItems="center"
            spacing={2}
            sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}
          >
            <Avatar sx={{ bgcolor: "primary.main", width: 36, height: 36, fontSize: 14 }}>
              {prof.name.charAt(0).toUpperCase()}
            </Avatar>
            <Typography sx={{ flexGrow: 1 }}>{prof.name}</Typography>
            <Chip
              label={prof.active ? "ATIVO" : "INATIVO"}
              color={prof.active ? "success" : "default"}
              size="small"
            />
          </Stack>
        ))}
      </Paper>

      <Paper elevation={1} sx={{ p: 2.5, maxWidth: 420 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1.5 }}>
          Novo profissional
        </Typography>
        <Stack component="form" action={createProfessional} direction="row" spacing={1.5}>
          <TextField name="name" label="Nome" size="small" fullWidth required />
          <Button type="submit" variant="contained">
            Adicionar
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
