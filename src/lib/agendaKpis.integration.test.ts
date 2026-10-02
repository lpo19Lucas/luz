import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon, futureSlotTime } from "@tests/integration/helpers";
import { getAgendaKpis } from "@/lib/agendaKpis";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("getAgendaKpis", () => {
  it("soma faturamento previsto (não cancelados) e realizado (COMPLETED) e conta faltas", async () => {
    const { salon, professional, service } = await createTestSalon();
    const client = await prisma.client.create({
      data: { salonId: salon.id, name: "Cliente", phone: "11999990000" },
    });

    const rangeStart = futureSlotTime(1);
    const rangeEnd = futureSlotTime(72);

    async function makeAppointment(status: "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW") {
      const startAt = futureSlotTime(24);
      await prisma.appointment.create({
        data: {
          salonId: salon.id,
          professionalId: professional.id,
          serviceId: service.id,
          clientId: client.id,
          startAt,
          endAt: new Date(startAt.getTime() + service.durationMinutes * 60_000),
          status,
        },
      });
    }

    await makeAppointment("CONFIRMED");
    await makeAppointment("CANCELLED");
    await makeAppointment("COMPLETED");
    await makeAppointment("NO_SHOW");

    const kpis = await getAgendaKpis(salon.id, rangeStart, rangeEnd);

    // 3 não cancelados (CONFIRMED + COMPLETED + NO_SHOW), 1 cancelado de fora.
    expect(kpis.scheduledCount).toBe(3);
    expect(kpis.completedCount).toBe(1);
    expect(kpis.noShowCount).toBe(1);
    expect(kpis.expectedRevenueCents).toBe(service.priceCents * 3);
    expect(kpis.realizedRevenueCents).toBe(service.priceCents);
    expect(kpis.occupiedMinutes).toBe(service.durationMinutes * 3);
  });

  it("ignora agendamentos fora do período", async () => {
    const { salon, professional, service } = await createTestSalon();
    const client = await prisma.client.create({
      data: { salonId: salon.id, name: "Cliente", phone: "11999990000" },
    });
    const farStart = futureSlotTime(24 * 30); // 30 dias no futuro — fora do range testado
    await prisma.appointment.create({
      data: {
        salonId: salon.id,
        professionalId: professional.id,
        serviceId: service.id,
        clientId: client.id,
        startAt: farStart,
        endAt: new Date(farStart.getTime() + service.durationMinutes * 60_000),
      },
    });

    const kpis = await getAgendaKpis(salon.id, futureSlotTime(1), futureSlotTime(72));
    expect(kpis.scheduledCount).toBe(0);
  });
});
