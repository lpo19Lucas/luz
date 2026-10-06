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
  Rating,
} from "@mui/material";
import AddToCalendarButtons, { type CalendarLinks } from "../../AddToCalendarButtons";

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
  hasReview: boolean;
  canReview: boolean;
  rescheduledCount: number;
  calendar: CalendarLinks | null;
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

  const [reviewRating, setReviewRating] = useState<number | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

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

  async function handleSubmitReview() {
    if (!reviewRating) return;
    setReviewSubmitting(true);
    setReviewError(null);
    try {
      const res = await fetch(`/api/appointments/${accessToken}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReviewError(data.error ?? "Não foi possível enviar a avaliação.");
        return;
      }
      load();
    } finally {
      setReviewSubmitting(false);
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

  const statusVisual: Record<AppointmentDetails["status"], { icon: string; bg: string; color: string }> = {
    AWAITING_CONFIRMATION: { icon: "🕓", bg: "#F4EFE3", color: "#9A7B1F" },
    CONFIRMED: { icon: "✓", bg: "#EAF4EC", color: "#2F7D4F" },
    COMPLETED: { icon: "✓", bg: "#F4EFE3", color: "#9A7B1F" },
    CANCELLED: { icon: "✕", bg: "#FBEAEA", color: "#B3453C" },
    NO_SHOW: { icon: "✕", bg: "#FBEAEA", color: "#B3453C" },
  };
  const visual = statusVisual[appointment.status];

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar
        position="static"
        elevation={0}
        sx={{ bgcolor: "primary.main", backgroundImage: "linear-gradient(135deg,#1B2A4A,#2E4472)" }}
      >
        <Toolbar>
          <Typography variant="h6" sx={{ color: "#FAF7F2" }}>
            {appointment.salonName}
          </Typography>
        </Toolbar>
      </AppBar>
      <Box sx={{ maxWidth: 420, mx: "auto", p: 2.5 }}>
        <Box sx={{ textAlign: "center", mb: 3 }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              bgcolor: visual.bg,
              color: visual.color,
              fontSize: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mx: "auto",
              mb: 1.5,
            }}
          >
            {visual.icon}
          </Box>
          <Typography variant="h6">{STATUS_LABEL[appointment.status]}</Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: 2.5, mb: 2, borderRadius: 3 }}>
          <Typography variant="body1" sx={{ fontWeight: 700 }}>
            {appointment.serviceName} com {appointment.professionalName}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
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

        {appointment.calendar && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3 }}>
            <AddToCalendarButtons
              links={appointment.calendar}
              note={
                appointment.rescheduledCount > 0
                  ? "Remarcou? Adicione de novo — o .ics substitui o evento antigo; no Google, apague o anterior."
                  : "O evento já vem com lembrete 2 horas antes."
              }
            />
          </Paper>
        )}

        {actionMessage && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {actionMessage}
          </Alert>
        )}

        {appointment.hasReview && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Você já avaliou este atendimento, obrigado!
          </Alert>
        )}

        {appointment.canReview && (
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Avalie seu atendimento
            </Typography>
            <Stack spacing={1.5} alignItems="flex-start">
              <Rating
                value={reviewRating}
                onChange={(_e, value) => setReviewRating(value)}
                disabled={reviewSubmitting}
              />
              <TextField
                multiline
                minRows={2}
                fullWidth
                placeholder="Comentário (opcional)"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                disabled={reviewSubmitting}
              />
              {reviewError && <Alert severity="error">{reviewError}</Alert>}
              <Button
                variant="contained"
                disabled={!reviewRating || reviewSubmitting}
                onClick={handleSubmitReview}
              >
                {reviewSubmitting ? "Enviando..." : "Enviar avaliação"}
              </Button>
            </Stack>
          </Paper>
        )}

        {!reschedulingOpen && (
          <Stack spacing={1.25}>
            {canConfirm && (
              <Button
                variant="contained"
                fullWidth
                disabled={actionLoading !== null}
                onClick={() => handleAction("confirm-presence")}
                sx={{ bgcolor: "primary.main", color: "secondary.main", py: 1.5, "&:hover": { bgcolor: "primary.dark" } }}
              >
                {actionLoading === "confirm" ? "Confirmando..." : "Confirmar presença"}
              </Button>
            )}
            {canReschedule && (
              <Button
                variant="outlined"
                fullWidth
                disabled={actionLoading !== null}
                onClick={() => setReschedulingOpen(true)}
                sx={{ py: 1.5, borderWidth: 1.5 }}
              >
                Reagendar
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outlined"
                color="error"
                fullWidth
                disabled={actionLoading !== null}
                onClick={() => handleAction("cancel")}
                sx={{ py: 1.5, borderWidth: 1.5 }}
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
