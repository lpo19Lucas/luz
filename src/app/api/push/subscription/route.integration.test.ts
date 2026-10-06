/**
 * Teste de integração — Postgres real (`postgres_test`).
 *
 * Rota de inscrição do aparelho: cliente se inscreve pelo token do
 * agendamento; dono pela sessão; sem nenhum dos dois, recusa.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon, futureSlotTime } from "@tests/integration/helpers";
import { createAppointment } from "@/lib/booking";

let session: { userId: string; issuedAt: number } | null = null;
jest.mock("@/lib/auth", () => ({ ...jest.requireActual("@/lib/auth"), getSession: async () => session }));

import { GET, POST, DELETE } from "./route";

const subscription = { endpoint: "https://push.example.com/abc", keys: { p256dh: "p", auth: "a" } };

function req(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/push/subscription", {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "user-agent": "Teste/1.0" },
  });
}

beforeAll(() => {
  process.env.VAPID_PUBLIC_KEY = "chave-publica";
  process.env.VAPID_PRIVATE_KEY = "chave-privada";
});

beforeEach(async () => {
  await resetDb();
  session = null;
});

afterAll(async () => {
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  await prisma.$disconnect();
});

describe("/api/push/subscription", () => {
  it("GET devolve a chave pública", async () => {
    expect(await GET().json()).toEqual({ configured: true, publicKey: "chave-publica" });
  });

  it("cliente se inscreve pelo token do agendamento", async () => {
    const t = await createTestSalon();
    const { appointment } = await createAppointment({
      salonSlug: t.salon.slug,
      professionalId: t.professional.id,
      serviceId: t.service.id,
      clientName: "Ana",
      clientPhone: "11999990000",
      startAt: futureSlotTime(48),
      wantsToPayNow: false,
      source: "ONLINE",
      actor: "CLIENT",
    });
    const res = await POST(req("POST", { subscription, accessToken: appointment.accessToken }));
    expect(await res.json()).toEqual({ ok: true, audience: "client" });
    const row = await prisma.pushSubscription.findFirstOrThrow();
    expect(row).toMatchObject({ salonId: t.salon.id, clientId: appointment.clientId, userId: null, userAgent: "Teste/1.0" });
  });

  it("token inexistente → 404", async () => {
    expect((await POST(req("POST", { subscription, accessToken: "nao-existe" }))).status).toBe(404);
  });

  it("dono se inscreve pela sessão", async () => {
    const t = await createTestSalon();
    session = { userId: t.owner.id, issuedAt: Math.floor(Date.now() / 1000) };
    expect(await (await POST(req("POST", { subscription }))).json()).toEqual({ ok: true, audience: "owner" });
    expect((await prisma.pushSubscription.findFirstOrThrow()).userId).toBe(t.owner.id);
  });

  it("sem sessão nem token → 401; sessão de conta bloqueada → 401", async () => {
    expect((await POST(req("POST", { subscription }))).status).toBe(401);
    const t = await createTestSalon();
    await prisma.user.update({ where: { id: t.owner.id }, data: { disabledAt: new Date() } });
    session = { userId: t.owner.id, issuedAt: Math.floor(Date.now() / 1000) };
    expect((await POST(req("POST", { subscription }))).status).toBe(401);
  });

  it("inscrição malformada → 400", async () => {
    expect((await POST(req("POST", { subscription: { endpoint: "x" } }))).status).toBe(400);
  });

  it("DELETE remove o aparelho", async () => {
    const t = await createTestSalon();
    session = { userId: t.owner.id, issuedAt: Math.floor(Date.now() / 1000) };
    await POST(req("POST", { subscription }));
    await DELETE(req("DELETE", { endpoint: subscription.endpoint }));
    expect(await prisma.pushSubscription.count()).toBe(0);
  });
});
