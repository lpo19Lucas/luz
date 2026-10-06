/**
 * Teste de integração — Postgres real (`postgres_test`), web-push simulado.
 *
 * Cobre a infraestrutura de push: inscrição por aparelho (reassociação pelo
 * endpoint), envio só pros aparelhos do destinatário naquele salão, limpeza
 * de aparelho morto (404/410), desistência depois de falhas seguidas,
 * deduplicação do cron e o registro em notification_logs.
 */
import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon } from "@tests/integration/helpers";
import { saveSubscription, removeSubscription, notify, isValidSubscription, recipientKey } from "@/lib/push";

jest.mock("web-push", () => ({ __esModule: true, default: { setVapidDetails: jest.fn(), sendNotification: jest.fn() } }));
const send = webpush.sendNotification as jest.Mock;

const payload = { title: "Teste", body: "Olá", url: "/agenda" };
let counter = 0;
function sub() {
  counter++;
  return { endpoint: `https://push.example.com/${counter}`, keys: { p256dh: `p${counter}`, auth: `a${counter}` } };
}

beforeAll(() => {
  process.env.VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
});

beforeEach(async () => {
  await resetDb();
  send.mockReset();
  send.mockResolvedValue({ statusCode: 201 });
});

afterAll(async () => {
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  await prisma.$disconnect();
});

describe("inscrições", () => {
  it("valida o formato da inscrição", () => {
    expect(isValidSubscription(sub())).toBe(true);
    expect(isValidSubscription({ endpoint: "http://inseguro", keys: { p256dh: "x", auth: "y" } })).toBe(false);
    expect(isValidSubscription({ endpoint: "https://x" })).toBe(false);
    expect(isValidSubscription(null)).toBe(false);
  });

  it("o mesmo aparelho (endpoint) é reassociado em vez de duplicado", async () => {
    const t = await createTestSalon();
    const client = await prisma.client.create({ data: { salonId: t.salon.id, name: "Ana", phone: "11999990000" } });
    const s = sub();
    await saveSubscription(s, { salonId: t.salon.id, userId: t.owner.id }, "Chrome");
    await saveSubscription(s, { salonId: t.salon.id, clientId: client.id }, "Chrome");
    const rows = await prisma.pushSubscription.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: null, clientId: client.id });
    await removeSubscription(s.endpoint);
    expect(await prisma.pushSubscription.count()).toBe(0);
  });
});

describe("notify", () => {
  it("envia pra todos os aparelhos do destinatário naquele salão, e só pra eles", async () => {
    const a = await createTestSalon();
    const b = await createTestSalon();
    await saveSubscription(sub(), { salonId: a.salon.id, userId: a.owner.id });
    await saveSubscription(sub(), { salonId: a.salon.id, userId: a.owner.id });
    await saveSubscription(sub(), { salonId: b.salon.id, userId: b.owner.id });

    const result = await notify({ salonId: a.salon.id, recipient: { userId: a.owner.id }, type: "TEST", payload });
    expect(result).toEqual({ status: "SENT", devices: 2 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(JSON.parse(send.mock.calls[0][1])).toEqual(payload);

    const log = await prisma.notificationLog.findFirstOrThrow();
    expect(log).toMatchObject({ type: "TEST", status: "SENT", devices: 2, recipient: recipientKey({ userId: a.owner.id }) });
  });

  it("sem aparelho inscrito: registra NO_SUBSCRIPTION e não chama o serviço", async () => {
    const t = await createTestSalon();
    expect((await notify({ salonId: t.salon.id, recipient: { userId: t.owner.id }, type: "TEST", payload })).status).toBe(
      "NO_SUBSCRIPTION"
    );
    expect(send).not.toHaveBeenCalled();
    expect((await prisma.notificationLog.findFirstOrThrow()).status).toBe("NO_SUBSCRIPTION");
  });

  it("aparelho que respondeu 410 é apagado", async () => {
    const t = await createTestSalon();
    await saveSubscription(sub(), { salonId: t.salon.id, userId: t.owner.id });
    send.mockRejectedValueOnce(Object.assign(new Error("gone"), { statusCode: 410 }));
    const result = await notify({ salonId: t.salon.id, recipient: { userId: t.owner.id }, type: "TEST", payload });
    expect(result.status).toBe("FAILED");
    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  it("falha temporária soma tentativas e desiste depois de 5 seguidas", async () => {
    const t = await createTestSalon();
    await saveSubscription(sub(), { salonId: t.salon.id, userId: t.owner.id });
    send.mockRejectedValue(Object.assign(new Error("erro"), { statusCode: 500 }));
    jest.spyOn(console, "warn").mockImplementation(() => {});
    for (let i = 0; i < 4; i++) {
      await notify({ salonId: t.salon.id, recipient: { userId: t.owner.id }, type: "TEST", payload });
    }
    expect((await prisma.pushSubscription.findFirstOrThrow()).failureCount).toBe(4);
    await notify({ salonId: t.salon.id, recipient: { userId: t.owner.id }, type: "TEST", payload });
    expect(await prisma.pushSubscription.count()).toBe(0);
  });

  it("um sucesso zera a contagem de falhas", async () => {
    const t = await createTestSalon();
    const row = await saveSubscription(sub(), { salonId: t.salon.id, userId: t.owner.id });
    await prisma.pushSubscription.update({ where: { id: row.id }, data: { failureCount: 3 } });
    await notify({ salonId: t.salon.id, recipient: { userId: t.owner.id }, type: "TEST", payload });
    const after = await prisma.pushSubscription.findFirstOrThrow();
    expect(after.failureCount).toBe(0);
    expect(after.lastSuccessAt).not.toBeNull();
  });

  it("dedupeKey impede o segundo envio (cron rodando duas vezes)", async () => {
    const t = await createTestSalon();
    await saveSubscription(sub(), { salonId: t.salon.id, userId: t.owner.id });
    const args = { salonId: t.salon.id, recipient: { userId: t.owner.id }, type: "DAILY_AGENDA" as const, payload, dedupeKey: "daily:x:2026-10-06" };
    expect((await notify(args)).status).toBe("SENT");
    expect((await notify(args)).status).toBe("DUPLICATE");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("notifica o cliente pelos aparelhos dele", async () => {
    const t = await createTestSalon();
    const client = await prisma.client.create({ data: { salonId: t.salon.id, name: "Ana", phone: "11999990000" } });
    await saveSubscription(sub(), { salonId: t.salon.id, clientId: client.id });
    await saveSubscription(sub(), { salonId: t.salon.id, userId: t.owner.id });
    const result = await notify({ salonId: t.salon.id, recipient: { clientId: client.id }, type: "CLIENT_REMINDER_TODAY", payload });
    expect(result.devices).toBe(1);
  });

  it("sem chaves VAPID não faz nada", async () => {
    const t = await createTestSalon();
    delete process.env.VAPID_PRIVATE_KEY;
    try {
      expect((await notify({ salonId: t.salon.id, recipient: { userId: t.owner.id }, type: "TEST", payload })).status).toBe("DISABLED");
    } finally {
      process.env.VAPID_PRIVATE_KEY = "priv";
    }
  });
});
