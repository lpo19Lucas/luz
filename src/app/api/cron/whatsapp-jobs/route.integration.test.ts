import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon } from "@tests/integration/helpers";
import { GET } from "./route";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

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

    const res = await GET();
    const json = await res.json();

    expect(json.processed).toBe(1);
    const updated = await prisma.whatsAppMessageJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(updated.status).toBe("SENT");
    expect(updated.sentAt).not.toBeNull();
  });

  it("não processa jobs cujo horário ainda não chegou", async () => {
    const { job } = await createAppointmentWithJob(new Date(Date.now() + 60 * 60_000));

    const res = await GET();
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

    const res = await GET();
    const json = await res.json();

    expect(json.processed).toBe(0);
  });
});
