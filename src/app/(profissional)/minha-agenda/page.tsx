// Agenda do profissional (Fase P): hoje e os próximos 14 dias, mais os
// atendimentos já passados que ainda esperam "Concluído"/"Não compareceu".
import { Box, Typography, Paper, Stack, Chip, Button } from "@mui/material";
import { getCurrentProfessional } from "@/lib/currentSalon";
import { getProfessionalAgenda } from "@/lib/professionalAccess";
import { setOwnAppointmentOutcomeAction } from "@/lib/actions/professionalArea";
import { formatSalonDate, formatSalonTime, salonCalendarDay } from "@/lib/timezone";
import EnableNotifications from "../../EnableNotifications";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; color: "default" | "success" | "warning" | "error" | "info" }> = {
  AWAITING_CONFIRMATION: { label: "Aguardando confirmação", color: "warning" },
  CONFIRMED: { label: "Confirmado", color: "info" },
  COMPLETED: { label: "Concluído", color: "success" },
  NO_SHOW: { label: "Não compareceu", color: "error" },
  CANCELLED: { label: "Cancelado", color: "default" },
};

export default async function MinhaAgendaPage() {
  const member = await getCurrentProfessional();
  const appointments = await getProfessionalAgenda(member.professional.id);
  const now = new Date();
  const today = salonCalendarDay(now).getTime();

  // Agrupa por dia do calendário de Brasília.
  const groups = new Map<number, typeof appointments>();
  for (const appt of appointments) {
    const day = salonCalendarDay(appt.startAt).getTime();
    groups.set(day, [...(groups.get(day) ?? []), appt]);
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        Minha agenda
      </Typography>

      <Box sx={{ mb: 3 }}>
        <EnableNotifications
          title="Receba seus agendamentos no celular"
          description="Aviso na hora de cada novo agendamento, cancelamento ou remarcação, e o resumo do dia às 7h."
        />
      </Box>

      {appointments.length === 0 && (
        <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
          <Typography color="text.secondary">Nenhum atendimento nos próximos 14 dias.</Typography>
        </Paper>
      )}

      <Stack spacing={3}>
        {[...groups.entries()].map(([day, items]) => (
          <Box key={day}>
            <Typography variant="overline" color={day === today ? "secondary.dark" : "text.secondary"} sx={{ fontWeight: 700 }}>
              {day === today ? "Hoje · " : day < today ? "Pendente · " : ""}
              {formatSalonDate(items[0].startAt, { weekday: "long", day: "2-digit", month: "long" })}
            </Typography>
            <Stack spacing={1.25}>
              {items.map((appt) => {
                const status = STATUS[appt.status] ?? STATUS.CONFIRMED;
                const canMark = appt.startAt <= now && (appt.status === "CONFIRMED" || appt.status === "AWAITING_CONFIRMATION");
                return (
                  <Paper key={appt.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                      <Box>
                        <Typography sx={{ fontWeight: 700 }}>
                          {formatSalonTime(appt.startAt)} · {appt.service.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {appt.client.name} · {appt.service.durationMinutes} min
                        </Typography>
                      </Box>
                      <Chip size="small" color={status.color} label={status.label} />
                    </Stack>
                    {canMark && (
                      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                        {(["COMPLETED", "NO_SHOW"] as const).map((outcome) => (
                          <form key={outcome} action={setOwnAppointmentOutcomeAction}>
                            <input type="hidden" name="appointmentId" value={appt.id} />
                            <input type="hidden" name="outcome" value={outcome} />
                            <Button type="submit" size="small" variant={outcome === "COMPLETED" ? "contained" : "outlined"} color={outcome === "COMPLETED" ? "primary" : "error"}>
                              {outcome === "COMPLETED" ? "Concluído" : "Não compareceu"}
                            </Button>
                          </form>
                        ))}
                      </Stack>
                    )}
                  </Paper>
                );
              })}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
