/**
 * Teste de integração — Postgres real (`postgres_test`).
 *
 * Cobre os planos da plataforma vindos de platform_plans (editáveis no
 * /admin/planos): leitura, filtro de planos à venda, textos derivados e o
 * fallback quando falta linha no banco.
 */
import { prisma } from "@/lib/prisma";
import { restoreDefaultPlans } from "@tests/integration/helpers";
import {
  getPlatformPlans,
  getPaidPlans,
  getTrialDays,
  planDurationDays,
  pricePerMonthCents,
  describePlan,
  formatBRL,
} from "@/lib/plans";

beforeEach(async () => {
  await restoreDefaultPlans();
});

afterAll(async () => {
  await restoreDefaultPlans();
  await prisma.$disconnect();
});

describe("planos da plataforma", () => {
  it("lê os 4 planos semeados pela migration, na ordem", async () => {
    const plans = await getPlatformPlans();
    expect(plans.map((p) => p.plan)).toEqual(["TRIAL", "MONTHLY", "QUARTERLY", "YEARLY"]);
    expect(await getTrialDays()).toBe(50);
    expect(await planDurationDays("YEARLY")).toBe(365);
  });

  it("getPaidPlans exclui o TRIAL e planos inativos", async () => {
    await prisma.platformPlan.update({ where: { plan: "QUARTERLY" }, data: { active: false } });
    const paid = await getPaidPlans();
    expect(paid.map((p) => p.plan)).toEqual(["MONTHLY", "YEARLY"]);
  });

  it("reflete edição de preço/duração feita pelo admin", async () => {
    await prisma.platformPlan.update({ where: { plan: "MONTHLY" }, data: { priceCents: 9900, label: "Mensal Pro" } });
    await prisma.platformPlan.update({ where: { plan: "TRIAL" }, data: { durationDays: 30 } });
    const monthly = (await getPaidPlans()).find((p) => p.plan === "MONTHLY")!;
    expect(monthly.label).toBe("Mensal Pro");
    expect(monthly.pricePerMonthCents).toBe(9900);
    expect(await getTrialDays()).toBe(30);
  });

  it("completa com o fallback quando falta a linha no banco", async () => {
    await prisma.platformPlan.delete({ where: { plan: "YEARLY" } });
    const yearly = (await getPlatformPlans()).find((p) => p.plan === "YEARLY");
    expect(yearly?.priceCents).toBe(70800);
  });
});

describe("textos derivados", () => {
  it("preço por mês equivalente", () => {
    expect(pricePerMonthCents({ priceCents: 20700, durationDays: 90 })).toBe(6900);
    expect(pricePerMonthCents({ priceCents: 70800, durationDays: 365 })).toBe(5900);
    expect(pricePerMonthCents({ priceCents: 7900, durationDays: 30 })).toBe(7900);
  });

  it("descrição automática quando o admin não preencheu", () => {
    const d = (plan: "TRIAL" | "MONTHLY" | "QUARTERLY" | "YEARLY", priceCents: number, durationDays: number) =>
      describePlan({ plan, priceCents, durationDays, description: null }).replace(/ /g, " ");
    expect(d("MONTHLY", 7900, 30)).toBe("cobrado todo mês");
    expect(d("QUARTERLY", 20700, 90)).toBe("R$ 207 a cada 3 meses");
    expect(d("YEARLY", 70800, 365)).toBe("R$ 708 uma vez ao ano");
    expect(d("TRIAL", 0, 50)).toBe("50 dias grátis");
  });

  it("descrição do admin tem prioridade", () => {
    expect(describePlan({ plan: "MONTHLY", priceCents: 1, durationDays: 30, description: " promo " })).toBe("promo");
  });

  it("formatBRL mostra centavos só quando há", () => {
    expect(formatBRL(7900).replace(/ /g, " ")).toBe("R$ 79");
    expect(formatBRL(7950).replace(/ /g, " ")).toBe("R$ 79,50");
  });
});
