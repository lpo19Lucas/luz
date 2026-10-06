/**
 * Teste de integração — Postgres real (`postgres_test`).
 *
 * Cobre as regras do painel admin: visão geral (receita, quem precisa de
 * atenção), busca/filtro de salões, ativação/renovação, extensão de teste,
 * ajuste manual, publicação, bloqueio do dono, edição do dono e dos planos.
 */
import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon, restoreDefaultPlans } from "@tests/integration/helpers";
import {
  getPlatformOverview,
  listSalonsForAdmin,
  getSalonForAdmin,
  adminActivateSubscription,
  adminExtendTrial,
  adminUpdateSubscription,
  adminSetPublished,
  adminSetOwnerDisabled,
  adminUpdateOwner,
  adminUpdatePlatformPlan,
  nextPeriodEnd,
  type SalonFilter,
} from "@/lib/adminSalons";
import { getSubscriptionAccess } from "@/lib/subscriptionAccess";

const DAY = 24 * 60 * 60_000;

beforeEach(async () => {
  await resetDb();
  await restoreDefaultPlans();
});

afterAll(async () => {
  await restoreDefaultPlans();
  await prisma.$disconnect();
});

async function setSub(salonId: string, data: Parameters<typeof prisma.subscription.update>[0]["data"]) {
  return prisma.subscription.update({ where: { salonId }, data });
}

describe("getPlatformOverview", () => {
  it("soma a receita mensal dos pagantes e lista quem precisa de atenção", async () => {
    const now = new Date();
    const paying = await createTestSalon();
    await setSub(paying.salon.id, { plan: "QUARTERLY", status: "ACTIVE", currentPeriodEnd: new Date(now.getTime() + 60 * DAY) });
    const ending = await createTestSalon();
    await setSub(ending.salon.id, { trialEndsAt: new Date(now.getTime() + 3 * DAY) });
    const grace = await createTestSalon({ subscriptionAccess: "GRACE" });
    const blocked = await createTestSalon({ subscriptionAccess: "BLOCKED" });
    await createTestSalon(); // teste longe de acabar — não entra em atenção

    const o = await getPlatformOverview(now);
    expect(o.totalSalons).toBe(5);
    expect(o.paying).toBe(1);
    expect(o.mrrCents).toBe(6900); // trimestral R$ 207 / 3
    expect(o.access).toEqual({ OK: 3, GRACE: 1, BLOCKED: 1 });
    const reasons = Object.fromEntries(o.attention.map((a) => [a.id, a.reason]));
    expect(reasons[ending.salon.id]).toBe("Teste acaba em até 7 dias");
    expect(reasons[grace.salon.id]).toBe("Em carência");
    expect(reasons[blocked.salon.id]).toBe("Bloqueado por falta de pagamento");
    expect(reasons[paying.salon.id]).toBeUndefined();
  });
});

describe("listSalonsForAdmin", () => {
  it("busca por nome do salão, e-mail ou nome do dono (sem diferenciar maiúsculas)", async () => {
    const a = await createTestSalon();
    await prisma.salon.update({ where: { id: a.salon.id }, data: { name: "Barbearia do Zé" } });
    await prisma.user.update({ where: { id: a.owner.id }, data: { email: "ze@barbearia.com", name: "José Silva" } });
    await createTestSalon();

    expect((await listSalonsForAdmin({ q: "barbearia do" })).map((s) => s.id)).toEqual([a.salon.id]);
    expect((await listSalonsForAdmin({ q: "ZE@BARB" })).map((s) => s.id)).toEqual([a.salon.id]);
    expect((await listSalonsForAdmin({ q: "josé" })).map((s) => s.id)).toEqual([a.salon.id]);
    expect(await listSalonsForAdmin({})).toHaveLength(2);
  });

  it("filtra por situação", async () => {
    const trial = await createTestSalon();
    const active = await createTestSalon();
    await setSub(active.salon.id, { status: "ACTIVE", plan: "MONTHLY", currentPeriodEnd: new Date(Date.now() + 10 * DAY) });
    const blocked = await createTestSalon({ subscriptionAccess: "BLOCKED" });
    const unpublished = await createTestSalon({ published: false });
    await prisma.user.update({ where: { id: unpublished.owner.id }, data: { disabledAt: new Date() } });

    const ids = async (filter: SalonFilter) =>
      (await listSalonsForAdmin({ filter })).map((s) => s.id).sort();
    expect(await ids("active")).toEqual([active.salon.id]);
    expect(await ids("blocked")).toEqual([blocked.salon.id]);
    expect(await ids("unpublished")).toEqual([unpublished.salon.id]);
    expect(await ids("disabled")).toEqual([unpublished.salon.id]);
    expect(await ids("trial")).toEqual([trial.salon.id, blocked.salon.id, unpublished.salon.id].sort());
  });

  it("getSalonForAdmin traz contagens e situação de acesso", async () => {
    const t = await createTestSalon();
    const detail = await getSalonForAdmin(t.salon.id);
    expect(detail?._count).toMatchObject({ professionals: 1, services: 1 });
    expect(detail?.access).toBe("OK");
    expect(await getSalonForAdmin("nao-existe")).toBeNull();
  });
});

describe("adminActivateSubscription", () => {
  it("ativa um plano pago a partir de hoje e registra a ativação", async () => {
    const t = await createTestSalon();
    const now = new Date();
    const sub = await adminActivateSubscription(t.salon.id, "MONTHLY", now);
    expect(sub.status).toBe("ACTIVE");
    expect(sub.plan).toBe("MONTHLY");
    expect(sub.currentPeriodEnd?.getTime()).toBe(now.getTime() + 30 * DAY);
    expect(sub.activatedAt).toEqual(now);
  });

  it("renovar o mesmo plano antes do vencimento empilha o período", async () => {
    const t = await createTestSalon();
    const now = new Date();
    const end = new Date(now.getTime() + 10 * DAY);
    await setSub(t.salon.id, { plan: "MONTHLY", status: "ACTIVE", currentPeriodEnd: end });
    const sub = await adminActivateSubscription(t.salon.id, "MONTHLY", now);
    expect(sub.currentPeriodEnd?.getTime()).toBe(end.getTime() + 30 * DAY);
  });

  it("trocar de plano começa um período novo a partir de hoje", async () => {
    const t = await createTestSalon();
    const now = new Date();
    await setSub(t.salon.id, { plan: "MONTHLY", status: "ACTIVE", currentPeriodEnd: new Date(now.getTime() + 10 * DAY) });
    const sub = await adminActivateSubscription(t.salon.id, "YEARLY", now);
    expect(sub.currentPeriodEnd?.getTime()).toBe(now.getTime() + 365 * DAY);
  });

  it("usa a duração editada no plano", async () => {
    await prisma.platformPlan.update({ where: { plan: "MONTHLY" }, data: { durationDays: 31 } });
    const now = new Date();
    expect((await nextPeriodEnd({ plan: "MONTHLY", currentPeriodEnd: null }, now)).getTime()).toBe(now.getTime() + 31 * DAY);
  });

  it("libera um salão bloqueado", async () => {
    const t = await createTestSalon({ subscriptionAccess: "BLOCKED" });
    const sub = await adminActivateSubscription(t.salon.id, "MONTHLY");
    expect(getSubscriptionAccess(sub)).toBe("OK");
  });

  it("não ativa o TRIAL como plano pago", async () => {
    const t = await createTestSalon();
    await expect(adminActivateSubscription(t.salon.id, "TRIAL")).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("adminExtendTrial", () => {
  it("soma ao fim do teste quando ainda não acabou", async () => {
    const t = await createTestSalon();
    const now = new Date();
    const end = new Date(now.getTime() + 5 * DAY);
    await setSub(t.salon.id, { trialEndsAt: end });
    const sub = await adminExtendTrial(t.salon.id, 10, now);
    expect(sub.trialEndsAt.getTime()).toBe(end.getTime() + 10 * DAY);
  });

  it("conta a partir de hoje quando o teste já acabou, e libera o acesso", async () => {
    const t = await createTestSalon({ subscriptionAccess: "BLOCKED" });
    const now = new Date();
    const sub = await adminExtendTrial(t.salon.id, 7, now);
    expect(sub.trialEndsAt.getTime()).toBe(now.getTime() + 7 * DAY);
    expect(getSubscriptionAccess(sub, now)).toBe("OK");
  });

  it("volta pra TRIAL quem estava em outro status", async () => {
    const t = await createTestSalon();
    await setSub(t.salon.id, { status: "CANCELLED", plan: "MONTHLY" });
    const sub = await adminExtendTrial(t.salon.id, 7);
    expect(sub.status).toBe("TRIAL");
    expect(sub.plan).toBe("TRIAL");
  });

  it("recusa número de dias inválido", async () => {
    const t = await createTestSalon();
    for (const days of [0, -3, 1.5, 400, NaN]) {
      await expect(adminExtendTrial(t.salon.id, days)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    }
  });
});

describe("adminUpdateSubscription", () => {
  it("grava plano, status e datas", async () => {
    const t = await createTestSalon();
    const trialEndsAt = new Date("2026-12-01T02:59:59.999Z");
    const currentPeriodEnd = new Date("2027-01-01T02:59:59.999Z");
    const sub = await adminUpdateSubscription(t.salon.id, { plan: "YEARLY", status: "ACTIVE", trialEndsAt, currentPeriodEnd });
    expect(sub).toMatchObject({ plan: "YEARLY", status: "ACTIVE", trialEndsAt, currentPeriodEnd });
  });

  it("ativa sem data de fim do período é recusado", async () => {
    const t = await createTestSalon();
    await expect(
      adminUpdateSubscription(t.salon.id, { plan: "MONTHLY", status: "ACTIVE", trialEndsAt: new Date(), currentPeriodEnd: null })
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("salão inexistente", async () => {
    await expect(
      adminUpdateSubscription("nao-existe", { plan: "TRIAL", status: "TRIAL", trialEndsAt: new Date(), currentPeriodEnd: null })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("salão e dono", () => {
  it("publica e despublica o link", async () => {
    const t = await createTestSalon({ published: false });
    expect((await adminSetPublished(t.salon.id, true)).publishedAt).not.toBeNull();
    expect((await adminSetPublished(t.salon.id, false)).publishedAt).toBeNull();
  });

  it("bloqueia e desbloqueia o acesso do dono", async () => {
    const t = await createTestSalon();
    expect((await adminSetOwnerDisabled(t.owner.id, true)).disabledAt).not.toBeNull();
    expect((await adminSetOwnerDisabled(t.owner.id, false)).disabledAt).toBeNull();
  });

  it("edita os dados do dono normalizando e-mail e telefone", async () => {
    const t = await createTestSalon();
    const user = await adminUpdateOwner(t.owner.id, { name: " Maria ", email: " Maria@Salao.com ", phone: "(21) 98888-1111" });
    expect(user).toMatchObject({ name: "Maria", email: "maria@salao.com", phone: "21988881111" });
  });

  it("não deixa usar o e-mail de outra conta", async () => {
    const a = await createTestSalon();
    const b = await createTestSalon();
    await expect(adminUpdateOwner(a.owner.id, { name: "A", email: b.owner.email, phone: "" })).rejects.toMatchObject({
      code: "EMAIL_TAKEN",
    });
    // O próprio e-mail continua valendo.
    await expect(adminUpdateOwner(a.owner.id, { name: "A", email: a.owner.email, phone: "" })).resolves.toBeTruthy();
  });

  it("recusa e-mail inválido", async () => {
    const t = await createTestSalon();
    await expect(adminUpdateOwner(t.owner.id, { name: "A", email: "sem-arroba", phone: "" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });
});

describe("adminUpdatePlatformPlan", () => {
  const base = { label: "Mensal", priceCents: 8900, durationDays: 30, description: null, active: true };

  it("atualiza preço, nome, duração e texto", async () => {
    await adminUpdatePlatformPlan("MONTHLY", { ...base, label: "Mensal Plus", description: " promo " });
    const row = await prisma.platformPlan.findUniqueOrThrow({ where: { plan: "MONTHLY" } });
    expect(row).toMatchObject({ label: "Mensal Plus", priceCents: 8900, durationDays: 30, description: "promo" });
  });

  it("TRIAL fica sempre grátis e ativo", async () => {
    await adminUpdatePlatformPlan("TRIAL", { ...base, label: "Teste", priceCents: 500, durationDays: 14, active: false });
    const row = await prisma.platformPlan.findUniqueOrThrow({ where: { plan: "TRIAL" } });
    expect(row).toMatchObject({ priceCents: 0, durationDays: 14, active: true });
  });

  it("plano pago precisa de preço e duração válidos", async () => {
    await expect(adminUpdatePlatformPlan("MONTHLY", { ...base, priceCents: 0 })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(adminUpdatePlatformPlan("MONTHLY", { ...base, priceCents: NaN })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(adminUpdatePlatformPlan("MONTHLY", { ...base, durationDays: 0 })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(adminUpdatePlatformPlan("MONTHLY", { ...base, label: " " })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("não deixa tirar o último plano pago de venda", async () => {
    await adminUpdatePlatformPlan("QUARTERLY", { ...base, active: false });
    await adminUpdatePlatformPlan("YEARLY", { ...base, active: false });
    await expect(adminUpdatePlatformPlan("MONTHLY", { ...base, active: false })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
