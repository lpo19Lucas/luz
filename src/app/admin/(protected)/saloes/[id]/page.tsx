// Detalhe do salão no admin: assinatura (ativar/renovar, estender teste,
// ajuste manual), publicação, acesso do dono (bloquear, link de senha,
// entrar como dono) e dados do dono.
import { notFound } from "next/navigation";
import { Box, Typography, Paper, Stack, Chip, Button, Divider } from "@mui/material";
import Link from "next/link";
import { getSalonForAdmin, getNotificationStats } from "@/lib/adminSalons";
import { getPlatformPlans, PLAN_LABEL, formatBRL } from "@/lib/plans";
import { formatSalonDate } from "@/lib/timezone";
import { formatPhone } from "@/lib/phone";
import { needsTermsAcceptance } from "@/lib/termsAcceptance";
import {
  activateSubscriptionAction,
  setSubscriptionStatusAction,
  setPublishedAction,
  setOwnerDisabledAction,
  impersonateOwnerAction,
} from "@/lib/actions/admin";
import { ACCESS_COLOR, ACCESS_LABEL, STATUS_COLOR, STATUS_LABEL, toDateInput } from "../../labels";
import { AccessLinkForm, ExtendTrialForm, OwnerForm, SubscriptionEditForm } from "./SalonAdminForms";

export const dynamic = "force-dynamic";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper elevation={1} sx={{ p: 2.5 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Typography variant="body2" sx={{ mb: 0.5 }}>
      <Box component="span" sx={{ color: "text.secondary" }}>
        {label}:
      </Box>{" "}
      {value}
    </Typography>
  );
}

export default async function AdminSalaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [salon, plans, push] = await Promise.all([getSalonForAdmin(id), getPlatformPlans(), getNotificationStats({ salonId: id })]);
  if (!salon) notFound();
  const sub = salon.subscription;
  const paidPlans = plans.filter((p) => p.plan !== "TRIAL");

  return (
    <Box>
      <Button component={Link} href="/admin/saloes" size="small" sx={{ mb: 1 }}>
        ← Salões
      </Button>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          {salon.name}
        </Typography>
        <Chip size="small" color={ACCESS_COLOR[salon.access]} label={ACCESS_LABEL[salon.access]} />
        {salon.owner.disabledAt && <Chip size="small" color="error" label="Acesso bloqueado" />}
        <Button component="a" href={`/${salon.slug}`} target="_blank" size="small">
          Ver página pública ↗
        </Button>
      </Stack>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        <Section title="Assinatura">
          {sub ? (
            <>
              <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                <Chip size="small" label={PLAN_LABEL[sub.plan] ?? sub.plan} />
                <Chip size="small" color={STATUS_COLOR[sub.status]} label={STATUS_LABEL[sub.status]} />
              </Stack>
              <Info label="Fim do teste" value={formatSalonDate(sub.trialEndsAt)} />
              <Info label="Fim do período pago" value={sub.currentPeriodEnd ? formatSalonDate(sub.currentPeriodEnd) : "—"} />
              <Info
                label="Última ativação"
                value={sub.activatedAt ? `${formatSalonDate(sub.activatedAt)} (${sub.activatedManuallyByEmail ?? "—"})` : "—"}
              />

              <Divider sx={{ my: 2 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Confira o PIX recebido antes de ativar. Renovar o mesmo plano soma o período ao vencimento atual.
              </Typography>
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mb: 2 }}>
                {paidPlans.map((p) => (
                  <form key={p.plan} action={activateSubscriptionAction}>
                    <input type="hidden" name="salonId" value={salon.id} />
                    <input type="hidden" name="plan" value={p.plan} />
                    <Button type="submit" size="small" variant={sub.plan === p.plan ? "contained" : "outlined"}>
                      {sub.status === "ACTIVE" && sub.plan === p.plan ? "Renovar" : "Ativar"} {p.label} ({formatBRL(p.priceCents)})
                    </Button>
                  </form>
                ))}
              </Stack>
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mb: 2 }}>
                {sub.status !== "PAST_DUE" && (
                  <form action={setSubscriptionStatusAction}>
                    <input type="hidden" name="salonId" value={salon.id} />
                    <input type="hidden" name="status" value="PAST_DUE" />
                    <Button type="submit" size="small" color="warning" variant="outlined">
                      Marcar pendente
                    </Button>
                  </form>
                )}
                {sub.status !== "CANCELLED" && (
                  <form action={setSubscriptionStatusAction}>
                    <input type="hidden" name="salonId" value={salon.id} />
                    <input type="hidden" name="status" value="CANCELLED" />
                    <Button type="submit" size="small" color="error" variant="outlined">
                      Cancelar assinatura
                    </Button>
                  </form>
                )}
              </Stack>

              <ExtendTrialForm salonId={salon.id} />
              <Divider sx={{ my: 2 }} />
              <SubscriptionEditForm
                salonId={salon.id}
                plan={sub.plan}
                status={sub.status}
                trialEndsAt={toDateInput(sub.trialEndsAt)}
                currentPeriodEnd={toDateInput(sub.currentPeriodEnd)}
                plans={plans.map((p) => ({ value: p.plan, label: p.label }))}
              />
            </>
          ) : (
            <Typography color="error">Salão sem assinatura (link público bloqueado).</Typography>
          )}
        </Section>

        <Stack spacing={2}>
          <Section title="Acesso do dono">
            <Info label="Termos" value={needsTermsAcceptance(salon.owner) ? "não aceitou a versão atual" : `aceitos em ${salon.owner.termsAcceptedAt ? formatSalonDate(salon.owner.termsAcceptedAt) : "—"}`} />
            <Info label="Conta criada" value={formatSalonDate(salon.owner.createdAt)} />
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, my: 1.5 }}>
              {!salon.owner.disabledAt && (
                <form action={impersonateOwnerAction}>
                  <input type="hidden" name="salonId" value={salon.id} />
                  <Button type="submit" size="small" variant="contained">
                    Entrar como o dono
                  </Button>
                </form>
              )}
              <form action={setOwnerDisabledAction}>
                <input type="hidden" name="salonId" value={salon.id} />
                <input type="hidden" name="disabled" value={salon.owner.disabledAt ? "false" : "true"} />
                <Button type="submit" size="small" variant="outlined" color={salon.owner.disabledAt ? "success" : "error"}>
                  {salon.owner.disabledAt ? "Desbloquear acesso" : "Bloquear acesso"}
                </Button>
              </form>
            </Stack>
            <AccessLinkForm salonId={salon.id} />
          </Section>

          <Section title="Salão">
            <Info label="Link" value={`/${salon.slug}`} />
            <Info label="Criado em" value={formatSalonDate(salon.createdAt)} />
            <Info
              label="Uso"
              value={`${salon._count.professionals} profissional(is), ${salon._count.services} serviço(s), ${salon._count.clients} cliente(s)`}
            />
            <Info
              label="Agendamentos"
              value={`${salon._count.appointments} no total, ${salon.appointmentsLast30} em 30 dias${
                salon.lastAppointmentAt ? ` (último ${formatSalonDate(salon.lastAppointmentAt)})` : ""
              }`}
            />
            <Info
              label="Notificações"
              value={`${push.staffDevices} aparelho(s) da equipe, ${push.clientDevices} de clientes · ${push.last7Days.sent} enviadas em 7 dias`}
            />
            {salon.whatsappPhone && <Info label="WhatsApp do salão" value={formatPhone(salon.whatsappPhone)} />}
            <form action={setPublishedAction}>
              <input type="hidden" name="salonId" value={salon.id} />
              <input type="hidden" name="published" value={salon.publishedAt ? "false" : "true"} />
              <Button type="submit" size="small" variant="outlined" sx={{ mt: 1 }}>
                {salon.publishedAt ? "Despublicar link" : "Publicar link"}
              </Button>
            </form>
          </Section>

          <Section title="Dados do dono">
            <OwnerForm salonId={salon.id} name={salon.owner.name} email={salon.owner.email} phone={salon.owner.phone ?? ""} />
          </Section>
        </Stack>
      </Box>
    </Box>
  );
}
