import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon } from "@tests/integration/helpers";
import { setAppointmentOutcome } from "./appointmentOutcome";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const HOUR = 60 * 60_000;

async function createAppointment(startOffsetMs: number, salonOverride?: string) {
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
      startAt: new Date(Date.now() + startOffsetMs),
      endAt: new Date(Date.now() + startOffsetMs + 30 * 60_000),
    },
  });
  await prisma.whatsAppMessageJob.create({
    data: {
      appointmentId: appointment.id,
      type: "REMINDER",
      scheduledFor: new Date(Date.now() + startOffsetMs + HOUR),
    },
  });
  return { salonId: salonOverride ?? salon.id, appointment };
}

describe("setAppointmentOutcome", () => {
  it("marca como concluído um atendimento que já começou e cancela jobs pendentes", async () => {
    const { salonId, appointment } = await createAppointment(-HOUR);

    const result = await setAppointmentOutcome({ salonId, appointmentId: appointment.id, outcome: "COMPLETED" });
    expect(result).toEqual({ ok: true });

    const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(updated.status).toBe("COMPLETED");
    const jobs = await prisma.whatsAppMessageJob.findMany({ where: { appointmentId: appointment.id } });
    expect(jobs.every((j) => j.status !== "PENDING")).toBe(true);
  });

  it("marca como não compareceu", async () => {
    const { salonId, appointment } = await createAppointment(-HOUR);

    await setAppointmentOutcome({ salonId, appointmentId: appointment.id, outcome: "NO_SHOW" });

    const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(updated.status).toBe("NO_SHOW");
  });

  it("desfazer volta o atendimento para confirmado", async () => {
    const { salonId, appointment } = await createAppointment(-HOUR);
    await setAppointmentOutcome({ salonId, appointmentId: appointment.id, outcome: "NO_SHOW" });

    const result = await setAppointmentOutcome({ salonId, appointmentId: appointment.id, outcome: "PENDING" });
    expect(result).toEqual({ ok: true });

    const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(updated.status).toBe("CONFIRMED");
  });

  it("recusa marcar desfecho antes do horário começar", async () => {
    const { salonId, appointment } = await createAppointment(2 * HOUR);

    const result = await setAppointmentOutcome({ salonId, appointmentId: appointment.id, outcome: "COMPLETED" });
    expect(result).toEqual({ ok: false, reason: "NOT_STARTED" });

    const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(updated.status).toBe("CONFIRMED");
  });

  it("recusa mexer em agendamento cancelado", async () => {
    const { salonId, appointment } = await createAppointment(-HOUR);
    await prisma.appointment.update({ where: { id: appointment.id }, data: { status: "CANCELLED" } });

    const result = await setAppointmentOutcome({ salonId, appointmentId: appointment.id, outcome: "COMPLETED" });
    expect(result).toEqual({ ok: false, reason: "CANCELLED" });
  });

  it("não deixa um salão mexer em agendamento de outro salão", async () => {
    const { appointment } = await createAppointment(-HOUR);
    const other = await createTestSalon();

    const result = await setAppointmentOutcome({
      salonId: other.salon.id,
      appointmentId: appointment.id,
      outcome: "COMPLETED",
    });
    expect(result).toEqual({ ok: false, reason: "NOT_FOUND" });

    const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(updated.status).toBe("CONFIRMED");
  });
});
