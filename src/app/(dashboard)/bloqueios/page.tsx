// CRUD de bloqueios de agenda (F4) — pontual ou recorrente, de um
// profissional ou do salão inteiro. src/lib/slots.ts já considera esses
// bloqueios no cálculo de horários livres (ver src/lib/agendaBlocks.ts).
import { Box, Typography, Paper, Stack, Button, Chip } from "@mui/material";
import { getCurrentSalon } from "@/lib/currentSalon";
import { prisma } from "@/lib/prisma";
import { deleteAgendaBlockAction } from "@/lib/actions/agendaBlock";
import { WEEKDAYS } from "@/lib/weekdays";
import AgendaBlockForm from "./AgendaBlockForm";
import type { AgendaBlock } from "@prisma/client";
import { getSegment, cap, businessOf, grammar } from "@/lib/segments";

const RECURRENCE_LABEL: Record<string, string> = {
  ONCE: "Só um dia",
  DAILY: "Todo dia",
  WEEKLY: "Toda semana",
};

/**
 * `date`/`startsOn`/`endsOn` são colunas `@db.Date` — sem hora nem fuso, só
 * calendário. Formatar com `timeZone: "UTC"` (não `formatSalonDate`, que
 * assume um instante de verdade e deslocaria um dia pra trás em Brasília).
 */
function formatDateOnly(date: Date) {
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
}

function describeBlock(block: AgendaBlock & { professional: { name: string } | null }) {
  const parts: string[] = [];

  if (block.recurrence === "ONCE" && block.date) {
    parts.push(formatDateOnly(block.date));
  } else if (block.recurrence === "WEEKLY" && block.weekday !== null) {
    parts.push(`toda ${WEEKDAYS[block.weekday].label}`);
  } else {
    parts.push("todo dia");
  }

  if (block.recurrence !== "ONCE" && (block.startsOn || block.endsOn)) {
    const from = block.startsOn ? formatDateOnly(block.startsOn) : "sempre";
    const to = block.endsOn ? formatDateOnly(block.endsOn) : "sempre";
    parts.push(`(${from} até ${to})`);
  }

  if (block.startTime && block.endTime) {
    parts.push(`das ${block.startTime} às ${block.endTime}`);
  } else {
    parts.push("dia inteiro");
  }

  return parts.join(" — ");
}

export default async function BloqueiosPage() {
  const salon = await getCurrentSalon();
  const vocab = getSegment(salon.segment).vocab;
  const apptG = grammar(vocab.appointmentGender);

  const [blocks, professionals] = await Promise.all([
    prisma.agendaBlock.findMany({
      where: { salonId: salon.id },
      include: { professional: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.professional.findMany({
      where: { salonId: salon.id, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 500, mb: 2 }}>
        Bloqueios de agenda
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Feriados, folgas e fechamentos — {vocab.client === "cliente" ? "o cliente" : `o ${vocab.client}`} não consegue agendar nesses dias/horários.
      </Typography>

      <Paper elevation={1} sx={{ mb: 3 }}>
        {blocks.length === 0 && (
          <Typography sx={{ p: 2 }} color="text.secondary">
            Nenhum bloqueio cadastrado ainda.
          </Typography>
        )}
        {blocks.map((block) => (
          <Stack
            key={block.id}
            direction="row"
            alignItems="center"
            spacing={1.5}
            sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}
          >
            <Chip
              label={block.professional ? block.professional.name : "Salão inteiro"}
              size="small"
              color={block.professional ? "default" : "primary"}
            />
            <Chip label={RECURRENCE_LABEL[block.recurrence]} size="small" variant="outlined" />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="body2">{describeBlock(block)}</Typography>
              {block.reason && (
                <Typography variant="caption" color="text.secondary">
                  {block.reason}
                </Typography>
              )}
            </Box>
            <form action={deleteAgendaBlockAction}>
              <input type="hidden" name="id" value={block.id} />
              <Button type="submit" size="small" color="error">
                Excluir
              </Button>
            </form>
          </Stack>
        ))}
      </Paper>

      <AgendaBlockForm professionals={professionals.map((p) => ({ id: p.id, name: p.name }))} segment={salon.segment} />
    </Box>
  );
}
