// Campos compartilhados entre "novo profissional" e "editar profissional":
// disponibilidade semanal (Availability) e quais serviços esse profissional
// realiza (ServiceProfessional). Ver src/lib/actions/professional.ts —
// sem isso, o profissional nunca aparece com horário livre na agenda pública.
import { Box, Typography, Stack, TextField, Checkbox, FormControlLabel } from "@mui/material";
import { WEEKDAYS } from "@/lib/weekdays";

type ServiceOption = { id: string; name: string };
type AvailabilityRow = { weekday: number; startTime: string; endTime: string };

export function AvailabilityFields({
  services,
  existingAvailability = [],
  existingServiceIds = [],
  professionalWord = "profissional",
}: {
  services: ServiceOption[];
  existingAvailability?: AvailabilityRow[];
  existingServiceIds?: string[];
  /** Vocabulário do segmento: "profissional", "box", "professor"... */
  professionalWord?: string;
}) {
  const byWeekday = new Map(existingAvailability.map((a) => [a.weekday, a]));

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Disponibilidade semanal
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
          Deixe início e fim em branco nos dias em que não há atendimento.
        </Typography>
        <Stack spacing={1}>
          {WEEKDAYS.map((day) => {
            const existing = byWeekday.get(day.value);
            return (
              <Stack key={day.value} direction="row" spacing={1.5} alignItems="center">
                <Typography variant="body2" sx={{ width: 130, flexShrink: 0 }}>
                  {day.label}
                </Typography>
                <TextField
                  name={`avail_${day.value}_start`}
                  type="time"
                  size="small"
                  defaultValue={existing?.startTime ?? ""}
                />
                <TextField
                  name={`avail_${day.value}_end`}
                  type="time"
                  size="small"
                  defaultValue={existing?.endTime ?? ""}
                />
              </Stack>
            );
          })}
        </Stack>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Serviços de {professionalWord}
        </Typography>
        {services.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Cadastre serviços primeiro na aba Serviços.
          </Typography>
        )}
        <Stack direction="row" sx={{ flexWrap: "wrap" }}>
          {services.map((s) => (
            <FormControlLabel
              key={s.id}
              sx={{ width: 220 }}
              control={
                <Checkbox name="serviceIds" value={s.id} defaultChecked={existingServiceIds.includes(s.id)} />
              }
              label={s.name}
            />
          ))}
        </Stack>
      </Box>
    </>
  );
}
