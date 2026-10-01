import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon, futureSlotTime } from "@tests/integration/helpers";
import { getClientStats, getAllClientStats } from "@/lib/clientStats";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("getClientStats / getAllClientStats", () => {
  it("conta só COMPLETED como visita/gasto e NO_SHOW como falta", async () => {
    const { salon, professional, service } = await createTestSalon();
    const client = await prisma.client.create({
      data: { salonId: salon.id, name: "Cliente", phone: "11999990000" },
    });

    async function makeAppointment(status: "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW", hoursFromNow: number) {
      const startAt = futureSlotTime(hoursFromNow);
      return prisma.appointment.create({
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

    await makeAppointment("CONFIRMED", 24);
    await makeAppointment("CANCELLED", 48);
    const firstCompleted = await makeAppointment("COMPLETED", 72);
    const secondCompleted = await makeAppointment("COMPLETED", 96);
    await makeAppointment("NO_SHOW", 120);

    const stats = await getClientStats(salon.id, client.id);
    expect(stats.visitCount).toBe(2);
    expect(stats.noShowCount).toBe(1);
    expect(stats.totalSpentCents).toBe(service.priceCents * 2);
    expect(stats.averageTicketCents).toBe(service.priceCents);
    expect(stats.lastVisitAt?.getTime()).toBe(secondCompleted.startAt.getTime());
    expect(firstCompleted.startAt.getTime()).toBeLessThan(secondCompleted.startAt.getTime());

    const all = await getAllClientStats(salon.id);
    expect(all.get(client.id)).toEqual(stats);
  });

  it("cliente sem agendamentos concluídos tem estatísticas zeradas", async () => {
    const { salon } = await createTestSalon();
    const client = await prisma.client.create({
      data: { salonId: salon.id, name: "Cliente Novo", phone: "11988887777" },
    });

    const stats = await getClientStats(salon.id, client.id);
    expect(stats).toEqual({
      visitCount: 0,
      noShowCount: 0,
      totalSpentCents: 0,
      averageTicketCents: 0,
      lastVisitAt: null,
    });
  });
});
