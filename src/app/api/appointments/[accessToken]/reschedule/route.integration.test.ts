import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon } from "@tests/integration/helpers";
import { POST } from "./route";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function postReschedule(accessToken: string, body: Record<string, unknown>) {
  const req = new NextRequest(`http://localhost/api/appointments/${accessToken}/reschedule`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ accessToken }) });
}

async function createAppointment(opts: {
  presenceConfirmationEnabled?: boolean;
  startInHours?: number;
  status?: "CONFIRMED" | "AWAITING_CONFIRMATION" | "CANCELLED" | "COMPLETED";
}) {
  const { salon, professional, service } = await createTestSalon({
    presenceConfirmationEnabled: opts.presenceConfirmationEnabled ?? false,
  });
  const client = await prisma.client.create({
    data: { salonId: salon.id, name: "Cliente", phone: "11999990000" },
  });
  const startInHours = opts.startInHours ?? 24;
  const appointment = await prisma.appointment.create({
    data: {
      salonId: salon.id,
      professionalId: professional.id,
      serviceId: service.id,
      clientId: client.id,
      startAt: new Date(Date.now() + startInHours * 60 * 60_000),
      endAt: new Date(Date.now() + startInHours * 60 * 60_000 + 30 * 60_000),
      status: opts.status ?? "CONFIRMED",
    },
  });
  return { appointment, salon, professional, service };
}

describe("POST /api/appointments/[accessToken]/reschedule", () => {
  it("move o agendamento pro novo horário e mantém o mesmo token", async () => {
    const { appointment } = await createAppointment({});
    const newStartAt = new Date(Date.now() + 48 * 60 * 60_000).toISOString();

    const res = await postReschedule(appointment.accessToken, { startAt: newStartAt });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.startAt).toBe(newStartAt);

    const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(updated.accessToken).toBe(appointment.accessToken);
    expect(updated.rescheduledCount).toBe(1);
    expect(updated.status).toBe("CONFIRMED");
  });

  it("volta pra AWAITING_CONFIRMATION quando a confirmação de presença está habilitada", async () => {
    const { appointment } = await createAppointment({ presenceConfirmationEnabled: true });
    const newStartAt = new Date(Date.now() + 48 * 60 * 60_000).toISOString();

    const res = await postReschedule(appointment.accessToken, { startAt: newStartAt });
    expect(res.status).toBe(200);

    const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(updated.status).toBe("AWAITING_CONFIRMATION");
  });

  it("recria os jobs de WhatsApp em cima do novo horário e cancela os antigos", async () => {
    const { appointment } = await createAppointment({ presenceConfirmationEnabled: true });
    await prisma.whatsAppMessageJob.create({
      data: { appointmentId: appointment.id, type: "REMINDER", scheduledFor: new Date() },
    });

    const newStartAt = new Date(Date.now() + 48 * 60 * 60_000).toISOString();
    await postReschedule(appointment.accessToken, { startAt: newStartAt });

    const jobs = await prisma.whatsAppMessageJob.findMany({ where: { appointmentId: appointment.id } });
    const oldJob = jobs.find((j) => j.failReason === "CANCELLED_BEFORE_SEND");
    expect(oldJob?.status).toBe("FAILED");

    const pending = jobs.filter((j) => j.status === "PENDING");
    expect(pending.map((j) => j.type).sort()).toEqual(["PRESENCE_CHECK", "REMINDER"].sort());
  });

  it("rejeita com 409 quando o novo horário já está ocupado", async () => {
    const { appointment, professional, service, salon } = await createAppointment({});
    const otherClient = await prisma.client.create({
      data: { salonId: salon.id, name: "Outro Cliente", phone: "11988880000" },
    });
    const busyStart = new Date(Date.now() + 48 * 60 * 60_000);
    await prisma.appointment.create({
      data: {
        salonId: salon.id,
        professionalId: professional.id,
        serviceId: service.id,
        clientId: otherClient.id,
        startAt: busyStart,
        endAt: new Date(busyStart.getTime() + 30 * 60_000),
        status: "CONFIRMED",
      },
    });

    const res = await postReschedule(appointment.accessToken, { startAt: busyStart.toISOString() });
    expect(res.status).toBe(409);
  });

  it("rejeita com 409 quando o agendamento já está cancelado", async () => {
    const { appointment } = await createAppointment({ status: "CANCELLED" });
    const res = await postReschedule(appointment.accessToken, {
      startAt: new Date(Date.now() + 48 * 60 * 60_000).toISOString(),
    });
    expect(res.status).toBe(409);
  });

  it("rejeita com 400 quando o novo horário é no passado", async () => {
    const { appointment } = await createAppointment({});
    const res = await postReschedule(appointment.accessToken, {
      startAt: new Date(Date.now() - 60 * 60_000).toISOString(),
    });
    expect(res.status).toBe(400);
  });

  it("retorna 404 quando o token não existe", async () => {
    const res = await postReschedule("token-inexistente", {
      startAt: new Date(Date.now() + 48 * 60 * 60_000).toISOString(),
    });
    expect(res.status).toBe(404);
  });
});
