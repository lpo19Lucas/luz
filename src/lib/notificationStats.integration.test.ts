/**
 * Teste de integração — Postgres real (`postgres_test`).
 *
 * Fase E5 — métricas de notificação do admin: aparelhos por público e taxa de
 * entrega dos últimos 7 dias (sem contar os testes manuais).
 */
import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon } from "@tests/integration/helpers";
import { getNotificationStats } from "@/lib/adminSalons";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("getNotificationStats", () => {
  it("conta aparelhos e entregas por salão e no total", async () => {
    const a = await createTestSalon();
    const b = await createTestSalon();
    const client = await prisma.client.create({ data: { salonId: a.salon.id, name: "Ana", phone: "11999990000" } });
    await prisma.pushSubscription.createMany({
      data: [
        { endpoint: "https://p/1", p256dh: "p", auth: "a", salonId: a.salon.id, userId: a.owner.id },
        { endpoint: "https://p/2", p256dh: "p", auth: "a", salonId: a.salon.id, clientId: client.id },
        { endpoint: "https://p/3", p256dh: "p", auth: "a", salonId: b.salon.id, userId: b.owner.id },
      ],
    });
    const log = (salonId: string, status: "SENT" | "FAILED" | "NO_SUBSCRIPTION", type: "BOOKING_CREATED" | "TEST" = "BOOKING_CREATED", daysAgo = 0) =>
      prisma.notificationLog.create({
        data: { salonId, type, status, recipient: "user:x", createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60_000) },
      });
    await log(a.salon.id, "SENT");
    await log(a.salon.id, "SENT");
    await log(a.salon.id, "SENT");
    await log(a.salon.id, "FAILED");
    await log(a.salon.id, "NO_SUBSCRIPTION");
    await log(a.salon.id, "SENT", "TEST"); // teste manual não conta
    await log(a.salon.id, "SENT", "BOOKING_CREATED", 10); // fora da janela
    await log(b.salon.id, "SENT");

    const salonA = await getNotificationStats({ salonId: a.salon.id });
    expect(salonA).toEqual({
      staffDevices: 1,
      clientDevices: 1,
      last7Days: { sent: 3, failed: 1, noSubscription: 1 },
      deliveryRate: 0.75,
    });
    const all = await getNotificationStats();
    expect(all.staffDevices).toBe(2);
    expect(all.last7Days.sent).toBe(4);
  });

  it("sem envios, taxa de entrega é nula", async () => {
    expect((await getNotificationStats()).deliveryRate).toBeNull();
  });
});
