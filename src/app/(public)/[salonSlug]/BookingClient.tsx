"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Stack,
  Avatar,
  Paper,
  Chip,
  TextField,
  Button,
  CircularProgress,
  Alert,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import Link from "next/link";
import {
  getSavedClientInfo,
  saveClientInfo,
  getSavedAppointmentTokens,
  addSavedAppointmentToken,
} from "@/lib/clientStorage";
import AddToCalendarButtons, { type CalendarLinks } from "./AddToCalendarButtons";
import InstallAppPrompt from "../../InstallAppPrompt";

type Professional = { id: string; name: string; photoUrl: string | null; serviceIds: string[] };
type Service = { id: string; name: string; durationMinutes: number; priceCents: number; imageUrl: string | null };
type SalonInfo = { name: string; professionals: Professional[]; services: Service[] };

type MyAppointment = {
  accessToken: string;
  status: string;
  startAt: string;
  serviceName: string;
  professionalName: string;
};

const STATUS_LABEL: Record<string, string> = {
  AWAITING_CONFIRMATION: "Aguardando confirmação",
  CONFIRMED: "Confirmado",
  CANCELLED: "Cancelado",
  COMPLETED: "Concluído",
  NO_SHOW: "Não compareceu",
};

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export default function BookingClient({ salonSlug }: { salonSlug: string }) {
  const [salon, setSalon] = useState<SalonInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISODate());
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [manageUrl, setManageUrl] = useState<string | null>(null);
  const [calendarLinks, setCalendarLinks] = useState<CalendarLinks | null>(null);

  const [myAppointments, setMyAppointments] = useState<MyAppointment[]>([]);

  const [usablePackage, setUsablePackage] = useState<{ id: string; name: string } | null>(null);
  const [usePackage, setUsePackage] = useState(false);

  // Cache local: pré-preenche com o nome/telefone da última vez que esse
  // navegador agendou nesse salão, e recupera os links dos agendamentos já
  // feitos aqui (sem precisar ter salvo o link do WhatsApp).
  useEffect(() => {
    const saved = getSavedClientInfo(salonSlug);
    if (saved) {
      setClientName(saved.name);
      setClientPhone(saved.phone);
    }

    const tokens = getSavedAppointmentTokens(salonSlug);
    if (tokens.length === 0) return;
    Promise.all(
      tokens.map((token) =>
        fetch(`/api/appointments/${token}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => (data ? { ...data, accessToken: token } : null))
          .catch(() => null)
      )
    ).then((results) => {
      setMyAppointments(results.filter((r): r is MyAppointment => r !== null));
    });
  }, [salonSlug]);

  useEffect(() => {
    fetch(`/api/salons/${salonSlug}`)
      .then((r) => {
        if (!r.ok) throw new Error("Salão não encontrado");
        return r.json();
      })
      .then((data: SalonInfo) => {
        setSalon(data);
        if (data.professionals.length > 0) setProfessionalId(data.professionals[0].id);
      })
      .catch((e) => setLoadError(e.message));
  }, [salonSlug]);

  const availableServices = useMemo(() => {
    if (!salon || !professionalId) return [];
    const prof = salon.professionals.find((p) => p.id === professionalId);
    if (!prof) return [];
    return salon.services.filter((s) => prof.serviceIds.includes(s.id));
  }, [salon, professionalId]);

  useEffect(() => {
    if (availableServices.length > 0 && !availableServices.some((s) => s.id === serviceId)) {
      setServiceId(availableServices[0].id);
    }
  }, [availableServices, serviceId]);

  useEffect(() => {
    if (!professionalId || !serviceId || !date) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    fetch(`/api/salons/${salonSlug}/slots?professionalId=${professionalId}&serviceId=${serviceId}&date=${date}`)
      .then((r) => r.json())
      .then((data: { slots: string[] }) => setSlots(data.slots))
      .finally(() => setLoadingSlots(false));
  }, [professionalId, serviceId, date, salonSlug]);

  // Checa se o telefone digitado tem pacote utilizável pro serviço escolhido —
  // só dispara com telefone plausível, pra não bater na API a cada tecla.
  useEffect(() => {
    setUsablePackage(null);
    setUsePackage(false);
    if (!serviceId || clientPhone.replace(/\D/g, "").length < 10) return;
    const timeout = setTimeout(() => {
      fetch(`/api/salons/${salonSlug}/usable-package?phone=${encodeURIComponent(clientPhone)}&serviceId=${serviceId}`)
        .then((r) => r.json())
        .then((data: { usablePackage: { id: string; name: string } | null }) => setUsablePackage(data.usablePackage))
        .catch(() => setUsablePackage(null));
    }, 400);
    return () => clearTimeout(timeout);
  }, [clientPhone, serviceId, salonSlug]);

  async function handleSubmit() {
    if (!professionalId || !serviceId || !selectedSlot || !clientName || !clientPhone) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/salons/${salonSlug}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professionalId,
          serviceId,
          clientName,
          clientPhone,
          startAt: selectedSlot,
          wantsToPayNow: false,
          usePackageId: usePackage && usablePackage ? usablePackage.id : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Erro ao criar agendamento");
        return;
      }
      setManageUrl(data.manageUrl);
      setCalendarLinks(data.calendar ?? null);
      saveClientInfo(salonSlug, { name: clientName, phone: clientPhone });
      addSavedAppointmentToken(salonSlug, data.accessToken);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Alert severity="error">{loadError}</Alert>
      </Box>
    );
  }

  if (!salon) {
    return (
      <Box sx={{ p: 6, textAlign: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (manageUrl) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
        <Header salonName={salon.name} />
        <Box sx={{ maxWidth: 480, mx: "auto", p: 3, textAlign: "center" }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              bgcolor: "secondary.main",
              color: "primary.main",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 700,
              mx: "auto",
              mb: 2,
            }}
          >
            ✓
          </Box>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Agendamento confirmado!
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Guarde este link para gerenciar seu agendamento (cancelar ou confirmar presença):
          </Typography>
          <Paper
            variant="outlined"
            sx={{ p: 1.5, wordBreak: "break-all", fontSize: 13, borderRadius: 3, bgcolor: "#FAF7F2" }}
          >
            <a href={manageUrl} style={{ color: "#1B2A4A" }}>
              {typeof window !== "undefined" ? window.location.origin : ""}
              {manageUrl}
            </a>
          </Paper>
          {calendarLinks && (
            <Box sx={{ mt: 3, textAlign: "left" }}>
              <AddToCalendarButtons links={calendarLinks} note="O evento já vem com lembrete 2 horas antes." />
            </Box>
          )}
          <Box sx={{ mt: 2, textAlign: "left" }}>
            <InstallAppPrompt
              appName={salon.name}
              description="Agende de novo em um toque e acompanhe seus horários pela tela inicial do celular."
            />
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: "background.default" }}>
      <Box sx={{ maxWidth: 480, mx: "auto", p: 2.5 }}>
        {myAppointments.length > 0 && (
          <Section title="Seus agendamentos neste salão">
            <Stack spacing={1}>
              {myAppointments.map((appt) => (
                <Paper
                  key={appt.accessToken}
                  component={Link}
                  href={`/${salonSlug}/agendamento/${appt.accessToken}`}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    textDecoration: "none",
                    color: "inherit",
                    borderRadius: 3,
                    transition: "transform .15s ease",
                    "&:hover": { transform: "translateY(-2px)" },
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {appt.serviceName} com {appt.professionalName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(appt.startAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Typography>
                  </Box>
                  <Chip label={STATUS_LABEL[appt.status] ?? appt.status} size="small" />
                </Paper>
              ))}
            </Stack>
          </Section>
        )}

        <Section title="Profissional">
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5 }}>
            {salon.professionals.map((p) => {
              const selected = professionalId === p.id;
              return (
                <Box
                  key={p.id}
                  onClick={() => setProfessionalId(p.id)}
                  sx={{
                    flex: "1 1 72px",
                    textAlign: "center",
                    py: 1.25,
                    px: 0.5,
                    borderRadius: 3,
                    cursor: "pointer",
                    border: "2px solid",
                    borderColor: selected ? "secondary.main" : "transparent",
                    bgcolor: selected ? "#FBF6E6" : "transparent",
                    transition: "transform .15s ease, border-color .15s ease",
                    "&:hover": { transform: "translateY(-2px)" },
                  }}
                >
                  <Avatar
                    src={p.photoUrl ?? undefined}
                    alt={p.name}
                    sx={{ mx: "auto", mb: 0.5, width: 52, height: 52, bgcolor: "primary.main", fontWeight: 700 }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography variant="caption" sx={{ fontWeight: selected ? 700 : 500 }}>
                    {p.name}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </Section>

        <Section title="Serviço">
          <Stack spacing={1.25}>
            {availableServices.map((s) => {
              const selected = serviceId === s.id;
              return (
                <Paper
                  key={s.id}
                  variant="outlined"
                  onClick={() => setServiceId(s.id)}
                  sx={{
                    p: 1.75,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    borderRadius: 3,
                    borderWidth: 2,
                    borderColor: selected ? "secondary.main" : "divider",
                    bgcolor: selected ? "#FBF6E6" : "transparent",
                    transition: "transform .15s ease, box-shadow .15s ease",
                    "&:hover": { transform: "translateY(-2px)", boxShadow: "0 8px 20px rgba(27,42,74,.08)" },
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
                    {s.imageUrl && (
                      <Avatar variant="rounded" src={s.imageUrl} alt={s.name} sx={{ width: 48, height: 48, borderRadius: 2 }} />
                    )}
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {s.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {s.durationMinutes} min
                      </Typography>
                    </Box>
                  </Box>
                  <Typography sx={{ fontWeight: 700, color: "primary.main" }}>
                    {formatPrice(s.priceCents)}
                  </Typography>
                </Paper>
              );
            })}
          </Stack>
        </Section>

        <Section title="Data">
          <TextField
            type="date"
            size="small"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            inputProps={{ min: todayISODate() }}
          />
        </Section>

        <Section title="Horário">
          {loadingSlots && <CircularProgress size={20} sx={{ color: "secondary.main" }} />}
          {!loadingSlots && slots.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Nenhum horário livre nesse dia.
            </Typography>
          )}
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            {slots.map((slot) => {
              const selected = selectedSlot === slot;
              return (
                <Chip
                  key={slot}
                  label={new Date(slot).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  onClick={() => setSelectedSlot(slot)}
                  sx={{
                    bgcolor: selected ? "primary.main" : "#FFFFFF",
                    color: selected ? "secondary.main" : "primary.main",
                    border: "1.5px solid",
                    borderColor: selected ? "primary.main" : "divider",
                  }}
                />
              );
            })}
          </Stack>
        </Section>

        <Section title="Seus dados">
          <Stack spacing={1.5}>
            <TextField
              label="Nome"
              size="small"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              fullWidth
            />
            <TextField
              label="Telefone"
              size="small"
              placeholder="(11) 99999-9999"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              fullWidth
            />
            {usablePackage && (
              <FormControlLabel
                control={<Checkbox checked={usePackage} onChange={(e) => setUsePackage(e.target.checked)} />}
                label={`Usar meu pacote "${usablePackage.name}" nesse agendamento`}
              />
            )}
            {submitError && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                {submitError}
              </Alert>
            )}
            <Button
              variant="contained"
              size="large"
              disabled={!selectedSlot || !clientName || !clientPhone || submitting}
              onClick={handleSubmit}
              sx={{
                bgcolor: "secondary.main",
                color: "primary.main",
                py: 1.5,
                fontSize: 15,
                "&:hover": { bgcolor: "secondary.dark" },
                "&.Mui-disabled": { bgcolor: "#E9E3D2", color: "#B0A98C" },
              }}
            >
              {submitting ? "Agendando..." : "Confirmar agendamento"}
            </Button>
            {/* LGPD: aviso de tratamento de dados (nome/telefone) no momento da coleta. */}
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
              Seu nome e telefone são usados só para gerenciar este agendamento com o salão. Veja a{" "}
              <a href="/privacidade" target="_blank" rel="noopener" style={{ color: "inherit" }}>
                Política de Privacidade
              </a>
              .
            </Typography>
          </Stack>
        </Section>
      </Box>
    </Box>
  );
}

function Header({ salonName }: { salonName: string }) {
  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{ bgcolor: "primary.main", backgroundImage: "linear-gradient(135deg,#1B2A4A,#2E4472)" }}
    >
      <Toolbar sx={{ flexDirection: "column", alignItems: "flex-start", py: 2.5 }}>
        <Typography variant="h6" sx={{ color: "#FAF7F2" }}>
          {salonName}
        </Typography>
        <Typography variant="caption" sx={{ color: "#D4AF37", fontWeight: 600 }}>
          Escolha o profissional, serviço e horário
        </Typography>
      </Toolbar>
    </AppBar>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography
        variant="overline"
        sx={{ display: "block", mb: 1.25, letterSpacing: 1, fontWeight: 700, color: "secondary.dark" }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}
