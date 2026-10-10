"use client";

import { useEffect, useMemo, useState } from "react";
import type { AssetKind } from "@prisma/client";
import AssetFields, { EMPTY_ASSET, type AssetFormValue } from "@/components/AssetFields";
import { useRouter } from "next/navigation";
import {
  Box,
  Paper,
  Typography,
  Stack,
  TextField,
  MenuItem,
  Chip,
  Button,
  CircularProgress,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";

type Professional = { id: string; name: string; serviceIds: string[] };
type Service = { id: string; name: string; durationMinutes: number; priceCents: number };

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export default function NewAppointmentForm({
  salonSlug,
  professionals,
  services,
  initialProfessionalId,
  initialDate,
  assetKind = null,
}: {
  salonSlug: string;
  professionals: Professional[];
  services: Service[];
  initialProfessionalId?: string;
  initialDate?: string;
  assetKind?: AssetKind | null;
}) {
  const router = useRouter();

  const [professionalId, setProfessionalId] = useState(
    initialProfessionalId && professionals.some((p) => p.id === initialProfessionalId)
      ? initialProfessionalId
      : professionals[0]?.id ?? ""
  );
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(initialDate ?? todayISODate());

  const [mode, setMode] = useState<"grade" | "encaixe">("grade");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [customTime, setCustomTime] = useState("09:00");

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [asset, setAsset] = useState<AssetFormValue>(EMPTY_ASSET);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const availableServices = useMemo(() => {
    const prof = professionals.find((p) => p.id === professionalId);
    if (!prof) return [];
    return services.filter((s) => prof.serviceIds.includes(s.id));
  }, [professionals, services, professionalId]);

  useEffect(() => {
    if (availableServices.length > 0 && !availableServices.some((s) => s.id === serviceId)) {
      setServiceId(availableServices[0].id);
    }
  }, [availableServices, serviceId]);

  useEffect(() => {
    if (mode !== "grade" || !professionalId || !serviceId || !date) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    fetch(`/api/salons/${salonSlug}/slots?professionalId=${professionalId}&serviceId=${serviceId}&date=${date}`)
      .then((r) => r.json())
      .then((data: { slots: string[] }) => setSlots(data.slots))
      .finally(() => setLoadingSlots(false));
  }, [mode, professionalId, serviceId, date, salonSlug]);

  const startAtISO = useMemo(() => {
    if (mode === "grade") return selectedSlot;
    if (!date || !customTime) return null;
    // Horário de encaixe: interpretado como horário local do navegador de
    // quem está operando (o dono, no salão) — suficiente pro MVP, sem exigir
    // lidar com o fuso do servidor aqui no cliente.
    const local = new Date(`${date}T${customTime}:00`);
    return Number.isNaN(local.getTime()) ? null : local.toISOString();
  }, [mode, date, customTime, selectedSlot]);

  async function handleSubmit() {
    if (!professionalId || !serviceId || !startAtISO || !clientName || !clientPhone) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/owner/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professionalId,
          serviceId,
          clientName,
          clientPhone,
          startAt: startAtISO,
          wantsToPayNow: false,
          asset: assetKind ? asset : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Erro ao criar agendamento");
        return;
      }
      router.push(`/agenda?date=${date}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Paper elevation={1} sx={{ p: 2.5 }}>
      <Stack spacing={2.5}>
        <TextField
          select
          label="Profissional"
          size="small"
          value={professionalId}
          onChange={(e) => setProfessionalId(e.target.value)}
        >
          {professionals.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Serviço"
          size="small"
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
        >
          {availableServices.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name} — {s.durationMinutes} min — {formatPrice(s.priceCents)}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          type="date"
          label="Data"
          size="small"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />

        <Box>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={mode}
            onChange={(_e, value) => value && setMode(value)}
            sx={{ mb: 1.5 }}
          >
            <ToggleButton value="grade">Horário da grade</ToggleButton>
            <ToggleButton value="encaixe">Encaixe livre</ToggleButton>
          </ToggleButtonGroup>

          {mode === "grade" ? (
            <Box>
              {loadingSlots && <CircularProgress size={20} />}
              {!loadingSlots && slots.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Nenhum horário livre nesse dia pra esse profissional/serviço.
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
            </Box>
          ) : (
            <Stack spacing={1}>
              <TextField
                type="time"
                label="Horário"
                size="small"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ maxWidth: 160 }}
              />
              <Typography variant="caption" color="text.secondary">
                O encaixe não respeita a disponibilidade cadastrada — só checa se o
                profissional já tem outro agendamento nesse horário.
              </Typography>
            </Stack>
          )}
        </Box>

        <TextField
          label="Nome do cliente"
          size="small"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
        />
        <TextField
          label="Telefone do cliente"
          size="small"
          placeholder="(11) 99999-9999"
          value={clientPhone}
          onChange={(e) => setClientPhone(e.target.value)}
        />
        {assetKind && <AssetFields kind={assetKind} value={asset} onChange={setAsset} required={false} />}

        {submitError && <Alert severity="error">{submitError}</Alert>}

        <Button
          variant="contained"
          disabled={!startAtISO || !clientName || !clientPhone || submitting}
          onClick={handleSubmit}
        >
          {submitting ? "Agendando..." : "Criar agendamento"}
        </Button>
      </Stack>
    </Paper>
  );
}
