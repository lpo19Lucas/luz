/**
 * Teste de integração — Postgres real (`postgres_test`).
 *
 * Regressão de segurança: server actions são endpoints públicos, então toda
 * action do admin precisa checar a sessão de admin por conta própria (a
 * versão antiga de setSubscriptionStatusAction não checava). Também cobre o
 * cadastro facilitado e o link de acesso gerado pelo admin.
 */
import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon, restoreDefaultPlans } from "@tests/integration/helpers";
import { findValidPasswordToken } from "@/lib/passwordReset";
// jest.mock abaixo é içado pelo Jest pra antes destes imports.

let isAdmin = false;
const createSession = jest.fn();

jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  getAdminSession: async () => isAdmin,
  createSession: (...args: unknown[]) => createSession(...args),
}));
jest.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

import {
  activateSubscriptionAction,
  setSubscriptionStatusAction,
  setOwnerDisabledAction,
  setPublishedAction,
  impersonateOwnerAction,
  createSalonAction,
  generateAccessLinkAction,
  updatePlatformPlanAction,
} from "@/lib/actions/admin";

function form(data: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

beforeEach(async () => {
  await resetDb();
  await restoreDefaultPlans();
  isAdmin = false;
  createSession.mockClear();
});

afterAll(async () => {
  await restoreDefaultPlans();
  await prisma.$disconnect();
});

describe("sem sessão de admin", () => {
  it("nenhuma action altera nada e todas redirecionam pro login", async () => {
    const t = await createTestSalon({ published: false });
    const salonId = t.salon.id;

    const calls: Array<() => Promise<unknown>> = [
      () => activateSubscriptionAction(form({ salonId, plan: "YEARLY" })),
      () => setSubscriptionStatusAction(form({ salonId, status: "ACTIVE" })),
      () => setOwnerDisabledAction(form({ salonId, disabled: "true" })),
      () => setPublishedAction(form({ salonId, published: "true" })),
      () => impersonateOwnerAction(form({ salonId })),
      () => createSalonAction(undefined, form({ salonName: "X", ownerName: "Y", email: "x@y.com" })),
      () => generateAccessLinkAction(undefined, form({ salonId })),
      () => updatePlatformPlanAction(undefined, form({ plan: "MONTHLY", label: "Grátis", price: "0,01", durationDays: "30", active: "on" })),
    ];
    for (const call of calls) {
      await expect(call()).rejects.toThrow("REDIRECT:/admin/login");
    }

    const sub = await prisma.subscription.findUniqueOrThrow({ where: { salonId } });
    expect(sub.status).toBe("TRIAL");
    const salon = await prisma.salon.findUniqueOrThrow({ where: { id: salonId }, include: { owner: true } });
    expect(salon.publishedAt).toBeNull();
    expect(salon.owner.disabledAt).toBeNull();
    expect(await prisma.salon.count()).toBe(1);
    expect(await prisma.passwordResetToken.count()).toBe(0);
    expect((await prisma.platformPlan.findUniqueOrThrow({ where: { plan: "MONTHLY" } })).priceCents).toBe(7900);
    expect(createSession).not.toHaveBeenCalled();
  });
});

describe("com sessão de admin", () => {
  beforeEach(() => {
    isAdmin = true;
  });

  it("cadastro facilitado cria o salão sem aceite e devolve convite válido + WhatsApp", async () => {
    const state = await createSalonAction(
      undefined,
      form({ salonName: "Studio Bia", ownerName: "Bia", email: "bia@studio.com", phone: "11977776666", plan: "TRIAL", trialDays: "30", serviceTemplate: "salao" })
    );
    expect(state?.error).toBeUndefined();
    expect(state?.salonId).toBeTruthy();
    expect(state?.whatsappHref).toMatch(/^https:\/\/wa\.me\/5511977776666\?text=/);

    const token = state!.link!.split("/redefinir-senha/")[1];
    const record = await findValidPasswordToken(token);
    expect(record?.purpose).toBe("INVITE");
    expect(record?.user.email).toBe("bia@studio.com");
    expect(record?.user.termsVersion).toBeNull();
    expect(await prisma.service.count({ where: { salonId: state!.salonId } })).toBe(3);
  });

  it("cadastro facilitado com e-mail repetido devolve erro amigável", async () => {
    const t = await createTestSalon();
    const state = await createSalonAction(undefined, form({ salonName: "X", ownerName: "Y", email: t.owner.email }));
    expect(state?.error).toMatch(/Já existe/);
  });

  it("link de acesso: RESET pra quem já aceitou os termos, INVITE pra quem não", async () => {
    const t = await createTestSalon();
    const invite = await generateAccessLinkAction(undefined, form({ salonId: t.salon.id }));
    expect((await findValidPasswordToken(invite!.link!.split("/redefinir-senha/")[1]))?.purpose).toBe("INVITE");

    await prisma.user.update({ where: { id: t.owner.id }, data: { termsVersion: "x", termsAcceptedAt: new Date() } });
    const reset = await generateAccessLinkAction(undefined, form({ salonId: t.salon.id }));
    expect((await findValidPasswordToken(reset!.link!.split("/redefinir-senha/")[1]))?.purpose).toBe("RESET");
    // Sem telefone do dono não há atalho de WhatsApp.
    expect(reset?.whatsappHref).toBeNull();
  });

  it("entrar como o dono abre sessão do dono e vai pra agenda", async () => {
    const t = await createTestSalon();
    await expect(impersonateOwnerAction(form({ salonId: t.salon.id }))).rejects.toThrow("REDIRECT:/agenda");
    expect(createSession).toHaveBeenCalledWith(t.owner.id);
  });

  it("não entra como dono bloqueado", async () => {
    const t = await createTestSalon();
    await prisma.user.update({ where: { id: t.owner.id }, data: { disabledAt: new Date() } });
    await impersonateOwnerAction(form({ salonId: t.salon.id }));
    expect(createSession).not.toHaveBeenCalled();
  });

  it("editar plano aceita preço com vírgula", async () => {
    const state = await updatePlatformPlanAction(
      undefined,
      form({ plan: "MONTHLY", label: "Mensal", price: "89,90", durationDays: "30", active: "on" })
    );
    expect(state?.success).toBeTruthy();
    expect((await prisma.platformPlan.findUniqueOrThrow({ where: { plan: "MONTHLY" } })).priceCents).toBe(8990);
  });
});
