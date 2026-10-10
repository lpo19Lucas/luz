"use client";

import { useState } from "react";
import { Paper, Typography, Stack, TextField, MenuItem, Button } from "@mui/material";
import { createAgendaBlockAction } from "@/lib/actions/agendaBlock";
import { WEEKDAYS } from "@/lib/weekdays";
import { cap, getSegment } from "@/lib/segments";

type Professional = { id: string; name: string };

export default function AgendaBlockForm({ professionals, segment }: { professionals: Professional[]; segment: string }) {
  const { vocab } = getSegment(segment);
  const [recurrence, setRecurrence] = useState<"ONCE" | "DAILY" | "WEEKLY">("ONCE");

  return (
    <Paper elevation={1} sx={{ p: 2.5, maxWidth: 480 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1.5 }}>
        Novo bloqueio
      </Typography>
      <Stack component="form" action={createAgendaBlockAction} spacing={1.5}>
        <TextField select name="professionalId" label={cap(vocab.professional)} size="small" defaultValue="">
          <MenuItem value="">{cap(vocab.business)} inteir{vocab.businessGender === "f" ? "a" : "o"} (feriado, fechamento)</MenuItem>
          {professionals.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          name="recurrence"
          label="Recorrência"
          size="small"
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value as typeof recurrence)}
        >
          <MenuItem value="ONCE">Só um dia</MenuItem>
          <MenuItem value="DAILY">Todo dia</MenuItem>
          <MenuItem value="WEEKLY">Toda semana, num dia fixo</MenuItem>
        </TextField>

        {recurrence === "ONCE" && (
          <TextField
            type="date"
            name="date"
            label="Dia"
            size="small"
            required
            InputLabelProps={{ shrink: true }}
          />
        )}

        {recurrence === "WEEKLY" && (
          <TextField select name="weekday" label="Dia da semana" size="small" required defaultValue="">
            {WEEKDAYS.map((w) => (
              <MenuItem key={w.value} value={w.value}>
                {w.label}
              </MenuItem>
            ))}
          </TextField>
        )}

        {recurrence !== "ONCE" && (
          <Stack direction="row" spacing={1.5}>
            <TextField
              type="date"
              name="startsOn"
              label="A partir de (opcional)"
              size="small"
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              type="date"
              name="endsOn"
              label="Até (opcional)"
              size="small"
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>
        )}

        <Stack direction="row" spacing={1.5}>
          <TextField
            type="time"
            name="startTime"
            label="Início (vazio = dia inteiro)"
            size="small"
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            type="time"
            name="endTime"
            label="Fim (vazio = dia inteiro)"
            size="small"
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
        </Stack>

        <TextField name="reason" label="Motivo (opcional)" size="small" placeholder="Feriado, folga, viagem..." />

        <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>
          Adicionar bloqueio
        </Button>
      </Stack>
    </Paper>
  );
}
