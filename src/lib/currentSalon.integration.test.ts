/**
 * Teste de integração — Postgres real (`postgres_test`).
 *
 * Regressão de segurança da Fase P: getCurrentSalon (porta de entrada de
 * TODAS as telas e actions do dono) nunca devolve o salão pra um profissional
 * — manda pra /minha-agenda. E a área do profissional manda o dono pra /agenda.
 */
import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon } from "@tests/integration/helpers";
import { grantProfessionalAccess } from "@/lib/professionalAccess";

let session: { userId: string; issuedAt: number } | null = null;
jest.mock("@/lib/auth", () => ({ ...jest.requireActual("@/lib/auth"), getSession: async () => session }));
jest.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { getCurrentSalon, getCurrentMember, getCurrentProfessional } from "@/lib/currentSalon";

const nowSec = () => Math.floor(Date.now() / 1000);

beforeEach(async () => {
  await resetDb();
  session = null;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("portas de entrada por papel", () => {
  it("dono recebe o próprio salão", async () => {
    const t = await createTestSalon();
    session = { userId: t.owner.id, issuedAt: nowSec() };
    expect((await getCurrentSalon()).id).toBe(t.salon.id);
    await expect(getCurrentProfessional()).rejects.toThrow("REDIRECT:/agenda");
  });

  it("profissional NUNCA recebe o salão pelo getCurrentSalon", async () => {
    const t = await createTestSalon();
    const { userId } = await grantProfessionalAccess({ salonId: t.salon.id, professionalId: t.professional.id, email: "joao@x.com" });
    session = { userId, issuedAt: nowSec() };
    await expect(getCurrentSalon()).rejects.toThrow("REDIRECT:/minha-agenda");
    expect((await getCurrentProfessional()).professional.id).toBe(t.professional.id);
    expect((await getCurrentMember()).role).toBe("PROFESSIONAL");
  });

  it("sem sessão → login; ex-profissional sem acesso → aviso no login", async () => {
    await expect(getCurrentSalon()).rejects.toThrow("REDIRECT:/login");
    const t = await createTestSalon();
    const { userId } = await grantProfessionalAccess({ salonId: t.salon.id, professionalId: t.professional.id, email: "joao@x.com" });
    await prisma.professional.update({ where: { id: t.professional.id }, data: { userId: null } });
    session = { userId, issuedAt: nowSec() };
    await expect(getCurrentSalon()).rejects.toThrow("REDIRECT:/login?sem-acesso=1");
  });

  it("dono bloqueado → aviso de bloqueio", async () => {
    const t = await createTestSalon();
    await prisma.user.update({ where: { id: t.owner.id }, data: { disabledAt: new Date() } });
    session = { userId: t.owner.id, issuedAt: nowSec() };
    await expect(getCurrentSalon()).rejects.toThrow("REDIRECT:/login?bloqueado=1");
  });
});
