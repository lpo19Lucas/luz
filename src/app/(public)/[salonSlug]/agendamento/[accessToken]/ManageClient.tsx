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
} from "@mui/material";

type AppointmentDetails = {
  status: "AWAITING_CONFIRMATION" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  startAt: string;
  salonName: string;
  professionalName: string;
  serviceName: string;
  clientName: string;
};

const STATUS_LABEL: Record<AppointmentDetails["status"], string> = {
  AWAITING_CONFIRMATION: "Aguardando sua confirmação",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  COMPLETED: "Concluído",
};

export default function ManageClient({ accessToken }: { accessToken: string }) {
  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<"cancel" | "confirm" | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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

        <Stack direction="row" spacing={1.5}>
          {canConfirm && (
            <Button
              variant="contained"
              disabled={actionLoading !== null}
              onClick={() => handleAction("confirm-presence")}
            >
              {actionLoading === "confirm" ? "Confirmando..." : "Confirmar presença"}
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
      </Box>
    </Box>
  );
}
