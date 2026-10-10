/**
 * Teste de integração — Postgres real (`postgres_test`).
 *
 * Cobre provisionSalon: cadastro self-service e cadastro facilitado do admin
 * criam conta + salão + assinatura + config numa transação, com o aceite dos
 * termos registrado e a duração do teste vinda de platform_plans.
 */
import { prisma } from "@/lib/prisma";
import { resetDb, restoreDefaultPlans } from "@tests/integration/helpers";
import { provisionSalon, ProvisionError } from "@/lib/salonProvisioning";
import { SEGMENTS } from "@/lib/segments";
import { LEGAL_VERSION } from "@/lib/legal";
import { getSubscriptionAccess } from "@/lib/subscriptionAccess";

const DAY = 24 * 60 * 60_000;
const base = { ownerName: "Ana Dona", email: "Ana@Teste.com", passwordHash: "hash", salonName: "Studio Ana" };

beforeEach(async () => {
  await resetDb();
  await restoreDefaultPlans();
});

afterAll(async () => {
  await restoreDefaultPlans();
  await prisma.$disconnect();
});

describe("provisionSalon", () => {
  it("cria usuário, salão, assinatura TRIAL e config de presença, com aceite dos termos", async () => {
    const now = new Date("2026-10-06T12:00:00Z");
    const { user, salon } = await provisionSalon({ ...base, phone: "(11) 98888-7777", termsAccepted: true, now });

    expect(user.email).toBe("ana@teste.com");
    expect(user.phone).toBe("11988887777");
    expect(user.termsAcceptedAt).toEqual(now);
    expect(user.termsVersion).toBe(LEGAL_VERSION);
    expect(salon.slug).toMatch(/^studio-ana/);

    const sub = await prisma.subscription.findUniqueOrThrow({ where: { salonId: salon.id } });
    expect(sub.plan).toBe("TRIAL");
    expect(sub.status).toBe("TRIAL");
    expect(sub.trialEndsAt.getTime()).toBe(now.getTime() + 50 * DAY);
    expect(getSubscriptionAccess(sub, now)).toBe("OK");

    const cfg = await prisma.presenceConfirmationConfig.findUnique({ where: { salonId: salon.id } });
    expect(cfg?.enabled).toBe(true);
  });

  it("não registra aceite quando termsAccepted = false (convite do admin)", async () => {
    const { user } = await provisionSalon({ ...base, termsAccepted: false });
    expect(user.termsAcceptedAt).toBeNull();
    expect(user.termsVersion).toBeNull();
  });

  it("usa a duração do teste configurada em platform_plans", async () => {
    await prisma.platformPlan.update({ where: { plan: "TRIAL" }, data: { durationDays: 14 } });
    const now = new Date();
    const { salon } = await provisionSalon({ ...base, termsAccepted: true, now });
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { salonId: salon.id } });
    expect(sub.trialEndsAt.getTime()).toBe(now.getTime() + 14 * DAY);
  });

  it("aceita trialDays explícito (admin dando mais dias no cadastro)", async () => {
    const now = new Date();
    const { salon } = await provisionSalon({ ...base, termsAccepted: false, trialDays: 90, now });
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { salonId: salon.id } });
    expect(sub.trialEndsAt.getTime()).toBe(now.getTime() + 90 * DAY);
  });

  it("com plano pago já nasce ACTIVE, com período e registro de ativação", async () => {
    const now = new Date();
    const { salon } = await provisionSalon({ ...base, termsAccepted: false, plan: "QUARTERLY", activatedBy: "admin", now });
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { salonId: salon.id } });
    expect(sub.status).toBe("ACTIVE");
    expect(sub.plan).toBe("QUARTERLY");
    expect(sub.currentPeriodEnd?.getTime()).toBe(now.getTime() + 90 * DAY);
    expect(sub.activatedAt).toEqual(now);
    expect(sub.activatedManuallyByEmail).toBe("admin");
  });

  it("grava o segmento e cria os serviços de exemplo dele", async () => {
    const { salon } = await provisionSalon({ ...base, termsAccepted: true, segment: "manicure", withSampleServices: true });
    expect(salon.segment).toBe("manicure");
    const services = await prisma.service.findMany({ where: { salonId: salon.id } });
    expect(services.map((s) => s.name).sort()).toEqual(SEGMENTS.manicure.sampleServices.map((s) => s.name).sort());
  });

  it("sem pedir serviços de exemplo, não cria nenhum; segmento omitido ou desconhecido vira barbearia", async () => {
    const a = await provisionSalon({ ...base, termsAccepted: true, segment: "manicure" });
    expect(await prisma.service.count({ where: { salonId: a.salon.id } })).toBe(0);
    const b = await provisionSalon({ ...base, email: "b@teste.com", salonName: "B", termsAccepted: true, segment: "nao-existe" });
    expect(b.salon.segment).toBe("barbearia");
    const c = await provisionSalon({ ...base, email: "c@teste.com", salonName: "C", termsAccepted: true });
    expect(c.salon.segment).toBe("barbearia");
  });

  it("recusa e-mail já cadastrado (sem diferenciar maiúsculas)", async () => {
    await provisionSalon({ ...base, termsAccepted: true });
    await expect(
      provisionSalon({ ...base, email: "ANA@teste.com", salonName: "Outro", termsAccepted: true })
    ).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
    expect(await prisma.salon.count()).toBe(1);
  });

  it("recusa campos obrigatórios vazios", async () => {
    await expect(provisionSalon({ ...base, salonName: "  ", termsAccepted: true })).rejects.toBeInstanceOf(ProvisionError);
    expect(await prisma.user.count()).toBe(0);
  });

  it("não deixa conta pela metade se algo falhar no meio da transação", async () => {
    // Força falha no último insert: um modelo de serviço com preço nulo viola
    // o NOT NULL de services.priceCents.
    const segment = SEGMENTS.manicure as unknown as { sampleServices: unknown };
    const original = segment.sampleServices;
    segment.sampleServices = [{ name: "Quebrado", durationMinutes: 30, priceCents: null }];
    try {
      await expect(
        provisionSalon({ ...base, termsAccepted: true, segment: "manicure", withSampleServices: true })
      ).rejects.toThrow();
    } finally {
      segment.sampleServices = original;
    }
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.salon.count()).toBe(0);
    expect(await prisma.subscription.count()).toBe(0);
  });
});
