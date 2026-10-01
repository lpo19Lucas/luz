"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Paper,
  Chip,
  Button,
  Stack,
  CircularProgress,
  Alert,
  TextField,
} from "@mui/material";

type AppointmentDetails = {
  status: "AWAITING_CONFIRMATION" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  startAt: string;
  salonName: string;
  salonSlug: string;
  professionalId: string;
  professionalName: string;
  serviceId: string;
  serviceName: string;
  clientName: string;
};

const STATUS_LABEL: Record<AppointmentDetails["status"], string> = {
  AWAITING_CONFIRMATION: "Aguardando sua confirmação",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  COMPLETED: "Concluído",
  NO_SHOW: "Não compareceu",
};

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export default function ManageClient({ accessToken }: { accessToken: string }) {
  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<"cancel" | "confirm" | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [reschedulingOpen, setReschedulingOpen] = useState(false);
  const [date, setDate] = useState(todayISODate());
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [reschedulingSubmitting, setReschedulingSubmitting] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/appointments/${accessToken}`)
      .then((r) => {
        if (!r.ok) throw new Error("Agendamento não encontrado");
        return r.json();
      })
      .then(setAppointment)
      .catch((e) => setError(e.message));
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!reschedulingOpen || !appointment) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    fetch(
      `/api/salons/${appointment.salonSlug}/slots?professionalId=${appointment.professionalId}&serviceId=${appointment.serviceId}&date=${date}`
    )
      .then((r) => r.json())
      .then((data: { slots: string[] }) => setSlots(data.slots))
      .finally(() => setLoadingSlots(false));
  }, [reschedulingOpen, appointment, date]);

  async function handleAction(action: "cancel" | "confirm-presence") {
    setActionLoading(action === "cancel" ? "cancel" : "confirm");
    setActionMessage(null);
    try {
      const res = await fetch(`/api/appointments/${accessToken}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setActionMessage(data.error ?? "Não foi possível completar a ação.");
        return;
      }
      load();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReschedule() {
    if (!selectedSlot) return;
    setReschedulingSubmitting(true);
    setRescheduleError(null);
    try {
      const res = await fetch(`/api/appointments/${accessToken}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startAt: selectedSlot }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRescheduleError(data.error ?? "Não foi possível reagendar.");
        return;
      }
      setReschedulingOpen(false);
      load();
    } finally {
      setReschedulingSubmitting(false);
    }
  }

  if (error) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!appointment) {
    return (
      <Box sx={{ p: 6, textAlign: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  const canCancel = appointment.status === "CONFIRMED" || appointment.status === "AWAITING_CONFIRMATION";
  const canConfirm = appointment.status === "AWAITING_CONFIRMATION" || appointment.status === "CONFIRMED";
  const canReschedule = appointment.status === "CONFIRMED" || appointment.status === "AWAITING_CONFIRMATION";

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Typography variant="h6">{appointment.salonName}</Typography>
        </Toolbar>
      </AppBar>
      <Box sx={{ maxWidth: 420, mx: "auto", p: 2.5 }}>
        <Paper elevation={1} sx={{ p: 2.5, mb: 2 }}>
          <Chip
            label={STATUS_LABEL[appointment.status]}
            color={
              appointment.status === "CANCELLED"
                ? "default"
                : appointment.status === "AWAITING_CONFIRMATION"
                  ? "warning"
                  : "success"
            }
            size="small"
            sx={{ mb: 1.5 }}
          />
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            {appointment.serviceName} com {appointment.professionalName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {new Date(appointment.startAt).toLocaleString("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            Cliente: {appointment.clientName}
          </Typography>
        </Paper>

        {actionMessage && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {actionMessage}
          </Alert>
        )}

        {!reschedulingOpen && (
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1 }}>
            {canConfirm && (
              <Button
                variant="contained"
                disabled={actionLoading !== null}
                onClick={() => handleAction("confirm-presence")}
              >
                {actionLoading === "confirm" ? "Confirmando..." : "Confirmar presença"}
              </Button>
            )}
            {canReschedule && (
              <Button variant="outlined" disabled={actionLoading !== null} onClick={() => setReschedulingOpen(true)}>
                Reagendar
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outlined"
                color="error"
                disabled={actionLoading !== null}
                onClick={() => handleAction("cancel")}
              >
                {actionLoading === "cancel" ? "Cancelando..." : "Cancelar"}
              </Button>
            )}
          </Stack>
        )}

        {reschedulingOpen && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
              Escolha o novo horário
            </Typography>
            <Stack spacing={1.5}>
              <TextField
                type="date"
                size="small"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                inputProps={{ min: todayISODate() }}
              />
              {loadingSlots && <CircularProgress size={20} />}
              {!loadingSlots && slots.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Nenhum horário livre nesse dia.
                </Typography>
              )}
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                {slots.map((slot) => (
                  <Chip
                    key={slot}
                    label={new Date(slot).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    onClick={() => setSelectedSlot(slot)}
                    color={selectedSlot === slot ? "primary" : "default"}
                    variant={selectedSlot === slot ? "filled" : "outlined"}
                  />
                ))}
              </Stack>
              {rescheduleError && <Alert severity="error">{rescheduleError}</Alert>}
              <Stack direction="row" spacing={1.5}>
                <Button
                  variant="contained"
                  disabled={!selectedSlot || reschedulingSubmitting}
                  onClick={handleReschedule}
                >
                  {reschedulingSubmitting ? "Reagendando..." : "Confirmar novo horário"}
                </Button>
                <Button variant="text" onClick={() => setReschedulingOpen(false)} disabled={reschedulingSubmitting}>
                  Cancelar
                </Button>
              </Stack>
            </Stack>
          </Paper>
        )}
      </Box>
    </Box>
  );
}
