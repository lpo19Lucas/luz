import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon } from "@tests/integration/helpers";
import { GET } from "./route";

beforeEach(async () => {
  await resetDb();
  delete process.env.CRON_SECRET;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function cronRequest(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/cron/whatsapp-jobs", { headers });
}

async function createAppointmentWithJob(scheduledFor: Date, status: "PENDING" = "PENDING") {
  const { salon, professional, service } = await createTestSalon();
  const client = await prisma.client.create({
    data: { salonId: salon.id, name: "Cliente", phone: "11999990000" },
  });
  const appointment = await prisma.appointment.create({
    data: {
      salonId: salon.id,
      professionalId: professional.id,
      serviceId: service.id,
      clientId: client.id,
      startAt: new Date(Date.now() + 24 * 60 * 60_000),
      endAt: new Date(Date.now() + 25 * 60 * 60_000),
    },
  });
  const job = await prisma.whatsAppMessageJob.create({
    data: {
      appointmentId: appointment.id,
      type: "REMINDER",
      status,
      scheduledFor,
    },
  });
  return { appointment, job };
}

describe("GET /api/cron/whatsapp-jobs", () => {
  it("processa e marca como SENT os jobs PENDING com horário vencido", async () => {
    const { job } = await createAppointmentWithJob(new Date(Date.now() - 60_000));

    const res = await GET(cronRequest());
    const json = await res.json();

    expect(json.processed).toBe(1);
    const updated = await prisma.whatsAppMessageJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(updated.status).toBe("SENT");
    expect(updated.sentAt).not.toBeNull();
  });

  it("não processa jobs cujo horário ainda não chegou", async () => {
    const { job } = await createAppointmentWithJob(new Date(Date.now() + 60 * 60_000));

    const res = await GET(cronRequest());
    const json = await res.json();

    expect(json.processed).toBe(0);
    const updated = await prisma.whatsAppMessageJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(updated.status).toBe("PENDING");
  });

  it("não reprocessa jobs que já foram enviados", async () => {
    const { job } = await createAppointmentWithJob(new Date(Date.now() - 60_000));
    await prisma.whatsAppMessageJob.update({
      where: { id: job.id },
      data: { status: "SENT", sentAt: new Date() },
    });

    const res = await GET(cronRequest());
    const json = await res.json();

    expect(json.processed).toBe(0);
  });

  it("rejeita com 401 quando CRON_SECRET está configurado e o header não bate", async () => {
    process.env.CRON_SECRET = "segredo-de-teste";

    const res = await GET(cronRequest());
    expect(res.status).toBe(401);
  });

  it("aceita quando o header Authorization bate com CRON_SECRET", async () => {
    process.env.CRON_SECRET = "segredo-de-teste";

    const res = await GET(cronRequest({ Authorization: "Bearer segredo-de-teste" }));
    expect(res.status).toBe(200);
  });

  describe("no-show (segunda metade da confirmação de presença)", () => {
    async function createAwaitingAppointment(opts: {
      hoursBefore?: number;
      actionOnNoConfirm?: "ALERT_ONLY" | "RELEASE_SLOT";
      startInHours: number;
      presenceEnabled?: boolean;
    }) {
      const { salon, professional, service } = await createTestSalon({
        presenceConfirmationEnabled: opts.presenceEnabled ?? true,
      });
      if (opts.hoursBefore !== undefined || opts.actionOnNoConfirm) {
        await prisma.presenceConfirmationConfig.update({
          where: { salonId: salon.id },
          data: {
            hoursBefore: opts.hoursBefore ?? 24,
            actionOnNoConfirm: opts.actionOnNoConfirm ?? "ALERT_ONLY",
          },
        });
      }
      const client = await prisma.client.create({
        data: { salonId: salon.id, name: "Cliente", phone: "11999990000" },
      });
      const appointment = await prisma.appointment.create({
        data: {
          salonId: salon.id,
          professionalId: professional.id,
          serviceId: service.id,
          clientId: client.id,
          startAt: new Date(Date.now() + opts.startInHours * 60 * 60_000),
          endAt: new Date(Date.now() + opts.startInHours * 60 * 60_000 + 30 * 60_000),
          status: "AWAITING_CONFIRMATION",
        },
      });
      return appointment;
    }

    it("cancela (libera o horário) quando actionOnNoConfirm é RELEASE_SLOT e o prazo já passou", async () => {
      const appointment = await createAwaitingAppointment({
        hoursBefore: 24,
        actionOnNoConfirm: "RELEASE_SLOT",
        startInHours: 1, // prazo de 24h antes já passou faz tempo
      });

      const res = await GET(cronRequest());
      const json = await res.json();
      expect(json.noShowReleased).toBe(1);

      const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
      expect(updated.status).toBe("CANCELLED");
      expect(updated.noShowHandledAt).not.toBeNull();
    });

    it("apenas sinaliza (não cancela) quando actionOnNoConfirm é ALERT_ONLY", async () => {
      const appointment = await createAwaitingAppointment({
        hoursBefore: 24,
        actionOnNoConfirm: "ALERT_ONLY",
        startInHours: 1,
      });

      const res = await GET(cronRequest());
      const json = await res.json();
      expect(json.noShowAlerted).toBe(1);

      const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
      expect(updated.status).toBe("AWAITING_CONFIRMATION");
      expect(updated.noShowHandledAt).not.toBeNull();
    });

    it("não age quando o prazo ainda não chegou", async () => {
      const appointment = await createAwaitingAppointment({
        hoursBefore: 24,
        actionOnNoConfirm: "RELEASE_SLOT",
        startInHours: 48, // prazo (24h antes) só chega em 24h
      });

      const res = await GET(cronRequest());
      const json = await res.json();
      expect(json.noShowReleased).toBe(0);
      expect(json.noShowAlerted).toBe(0);

      const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
      expect(updated.status).toBe("AWAITING_CONFIRMATION");
      expect(updated.noShowHandledAt).toBeNull();
    });

    it("não reprocessa um agendamento já tratado", async () => {
      const appointment = await createAwaitingAppointment({
        hoursBefore: 24,
        actionOnNoConfirm: "ALERT_ONLY",
        startInHours: 1,
      });

      await GET(cronRequest());
      const res = await GET(cronRequest());
      const json = await res.json();

      expect(json.noShowAlerted).toBe(0);
      const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
      expect(updated.status).toBe("AWAITING_CONFIRMATION");
    });

    it("ignora agendamentos de salões com confirmação de presença desabilitada", async () => {
      const appointment = await createAwaitingAppointment({
        startInHours: 1,
        presenceEnabled: false,
      });

      const res = await GET(cronRequest());
      const json = await res.json();
      expect(json.noShowReleased).toBe(0);
      expect(json.noShowAlerted).toBe(0);

      const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
      expect(updated.status).toBe("AWAITING_CONFIRMATION");
    });
  });
});
