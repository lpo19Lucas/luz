/**
 * Teste de integração — Postgres real (`postgres_test`).
 *
 * Cobre o limite de tentativas de login (força bruta): bloqueia depois de
 * MAX_FAILURES falhas na janela, libera quando a janela passa, e um sucesso
 * zera a contagem.
 */
import { prisma } from "@/lib/prisma";
import { resetDb } from "@tests/integration/helpers";
import { isRateLimited, recordAuthAttempt, clientIpFromHeaders, MAX_FAILURES, WINDOW_MS } from "@/lib/rateLimit";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function fail(key: string, times: number, at: Date) {
  for (let i = 0; i < times; i++) await recordAuthAttempt(key, false, at);
}

describe("isRateLimited", () => {
  const now = new Date("2026-10-06T12:00:00Z");

  it("não bloqueia abaixo do limite", async () => {
    await fail("login:a@a.com", MAX_FAILURES - 1, now);
    expect(await isRateLimited("login:a@a.com", now)).toBe(false);
  });

  it("bloqueia ao atingir o limite de falhas na janela", async () => {
    await fail("login:a@a.com", MAX_FAILURES, now);
    expect(await isRateLimited("login:a@a.com", now)).toBe(true);
  });

  it("chaves são independentes", async () => {
    await fail("login:a@a.com", MAX_FAILURES, now);
    expect(await isRateLimited("login:b@b.com", now)).toBe(false);
  });

  it("libera depois que a janela passa", async () => {
    await fail("login:a@a.com", MAX_FAILURES, now);
    const later = new Date(now.getTime() + WINDOW_MS + 1000);
    expect(await isRateLimited("login:a@a.com", later)).toBe(false);
  });

  it("um login com sucesso zera a contagem", async () => {
    await fail("login:a@a.com", MAX_FAILURES - 1, new Date(now.getTime() - 60_000));
    await recordAuthAttempt("login:a@a.com", true, new Date(now.getTime() - 30_000));
    await fail("login:a@a.com", MAX_FAILURES - 1, now);
    expect(await isRateLimited("login:a@a.com", now)).toBe(false);
  });

  it("apaga tentativas com mais de 24h da mesma chave", async () => {
    await fail("login:a@a.com", 3, new Date(now.getTime() - 2 * 24 * 60 * 60_000));
    await recordAuthAttempt("login:a@a.com", false, now);
    expect(await prisma.authAttempt.count({ where: { key: "login:a@a.com" } })).toBe(1);
  });
});

describe("clientIpFromHeaders", () => {
  it("usa o primeiro IP do x-forwarded-for", () => {
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
  });

  it("cai pro x-real-ip e depois pra desconhecido", () => {
    expect(clientIpFromHeaders(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIpFromHeaders(new Headers())).toBe("desconhecido");
  });
});
