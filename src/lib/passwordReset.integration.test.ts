/**
 * Teste de integração — Postgres real (`postgres_test`).
 *
 * Cobre a recuperação de acesso: pedido de "esqueci minha senha" (sem revelar
 * se a conta existe, com intervalo mínimo entre pedidos), link de uso único
 * com expiração, convite com aceite dos termos e troca de senha logado.
 */
import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon } from "@tests/integration/helpers";
import { hashPassword, verifyPassword, isSessionStillValid } from "@/lib/auth";
import {
  createPasswordToken,
  requestPasswordReset,
  findValidPasswordToken,
  resetPasswordWithToken,
  changePassword,
  hashToken,
  TOKEN_TTL_MS,
  RESET_REQUEST_COOLDOWN_MS,
} from "@/lib/passwordReset";
import { LEGAL_VERSION } from "@/lib/legal";

const sendEmail = jest.fn().mockResolvedValue({ delivered: true });
jest.mock("@/lib/email", () => ({
  ...jest.requireActual("@/lib/email"),
  sendEmail: (...args: unknown[]) => sendEmail(...args),
}));

beforeEach(async () => {
  await resetDb();
  sendEmail.mockClear();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// Por padrão a conta já aceitou os termos (como quem se cadastrou depois
// desta versão); `termsAccepted: false` simula conta antiga ou convite.
async function ownerWithPassword(password = "senha-antiga-123", { termsAccepted = true } = {}) {
  const { owner } = await createTestSalon();
  return prisma.user.update({
    where: { id: owner.id },
    data: { passwordHash: await hashPassword(password), termsAcceptedAt: termsAccepted ? new Date() : null, termsVersion: termsAccepted ? LEGAL_VERSION : null },
  });
}

describe("requestPasswordReset", () => {
  it("cria o token (só o hash no banco) e envia o e-mail com o link", async () => {
    const owner = await ownerWithPassword();
    const result = await requestPasswordReset(owner.email.toUpperCase());

    expect(result.status).toBe("SENT");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const message = sendEmail.mock.calls[0][0];
    expect(message.to).toBe(owner.email);
    const token = message.text.match(/redefinir-senha\/([\w-]+)/)[1];

    const stored = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: owner.id } });
    expect(stored.tokenHash).toBe(hashToken(token));
    expect(stored.tokenHash).not.toContain(token);
    expect(stored.purpose).toBe("RESET");
  });

  it("e-mail sem conta não envia nada (e quem chamou recebe a mesma resposta na action)", async () => {
    expect((await requestPasswordReset("ninguem@teste.com")).status).toBe("NO_ACCOUNT");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("conta bloqueada pelo admin não recebe link", async () => {
    const owner = await ownerWithPassword();
    await prisma.user.update({ where: { id: owner.id }, data: { disabledAt: new Date() } });
    expect((await requestPasswordReset(owner.email)).status).toBe("NO_ACCOUNT");
  });

  it("respeita o intervalo mínimo entre pedidos da mesma conta", async () => {
    const owner = await ownerWithPassword();
    const now = new Date();
    await requestPasswordReset(owner.email, now);
    expect((await requestPasswordReset(owner.email, new Date(now.getTime() + 30_000))).status).toBe("COOLDOWN");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const later = new Date(now.getTime() + RESET_REQUEST_COOLDOWN_MS + 1000);
    expect((await requestPasswordReset(owner.email, later)).status).toBe("SENT");
  });

  it("informa NOT_DELIVERED quando o e-mail não está configurado", async () => {
    sendEmail.mockResolvedValueOnce({ delivered: false });
    const owner = await ownerWithPassword();
    expect((await requestPasswordReset(owner.email)).status).toBe("NOT_DELIVERED");
  });
});

describe("resetPasswordWithToken", () => {
  it("troca a senha, marca o token como usado e derruba sessões antigas", async () => {
    const owner = await ownerWithPassword();
    const { token } = await createPasswordToken(owner.id, "RESET");
    const now = new Date();

    const result = await resetPasswordWithToken({ token, password: "nova-senha-123", confirmation: "nova-senha-123", now });
    expect(result).toEqual({ userId: owner.id, purpose: "RESET" });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: owner.id } });
    expect(await verifyPassword("nova-senha-123", user.passwordHash)).toBe(true);
    expect(user.passwordChangedAt).toEqual(now);
    const oldSession = { issuedAt: Math.floor(now.getTime() / 1000) - 3600 };
    expect(isSessionStillValid(oldSession, user)).toBe(false);
  });

  it("o link só pode ser usado uma vez", async () => {
    const owner = await ownerWithPassword();
    const { token } = await createPasswordToken(owner.id, "RESET");
    await resetPasswordWithToken({ token, password: "nova-senha-123" });
    await expect(resetPasswordWithToken({ token, password: "outra-senha-123" })).rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });

  it("dois envios simultâneos do mesmo link: só um vence", async () => {
    const owner = await ownerWithPassword();
    const { token } = await createPasswordToken(owner.id, "RESET");
    const results = await Promise.allSettled([
      resetPasswordWithToken({ token, password: "senha-um-1234" }),
      resetPasswordWithToken({ token, password: "senha-dois-1234" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("link expirado é recusado", async () => {
    const owner = await ownerWithPassword();
    const created = new Date("2026-10-06T10:00:00Z");
    const { token } = await createPasswordToken(owner.id, "RESET", created);
    const after = new Date(created.getTime() + TOKEN_TTL_MS.RESET + 1000);
    expect(await findValidPasswordToken(token, after)).toBeNull();
    await expect(resetPasswordWithToken({ token, password: "nova-senha-123", now: after })).rejects.toMatchObject({
      code: "INVALID_TOKEN",
    });
  });

  it("um token novo invalida o anterior", async () => {
    const owner = await ownerWithPassword();
    const first = await createPasswordToken(owner.id, "RESET");
    await createPasswordToken(owner.id, "RESET");
    expect(await findValidPasswordToken(first.token)).toBeNull();
  });

  it("token inexistente ou vazio é recusado", async () => {
    expect(await findValidPasswordToken("")).toBeNull();
    await expect(resetPasswordWithToken({ token: "nao-existe", password: "nova-senha-123" })).rejects.toMatchObject({
      code: "INVALID_TOKEN",
    });
  });

  it("recusa senha fraca ou confirmação diferente sem gastar o link", async () => {
    const owner = await ownerWithPassword();
    const { token } = await createPasswordToken(owner.id, "RESET");
    await expect(resetPasswordWithToken({ token, password: "123" })).rejects.toMatchObject({ code: "WEAK_PASSWORD" });
    await expect(resetPasswordWithToken({ token, password: "nova-senha-123", confirmation: "outra" })).rejects.toMatchObject({
      code: "WEAK_PASSWORD",
    });
    expect(await findValidPasswordToken(token)).not.toBeNull();
  });

  it("convite de conta sem aceite exige os termos e grava o aceite", async () => {
    const owner = await ownerWithPassword("senha-antiga-123", { termsAccepted: false });
    const { token } = await createPasswordToken(owner.id, "INVITE");
    expect(await findValidPasswordToken(token, new Date(Date.now() + 6 * 24 * 60 * 60_000))).not.toBeNull();

    await expect(resetPasswordWithToken({ token, password: "nova-senha-123" })).rejects.toMatchObject({ code: "TERMS_REQUIRED" });
    const result = await resetPasswordWithToken({ token, password: "nova-senha-123", acceptTerms: true });
    expect(result.purpose).toBe("INVITE");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: owner.id } });
    expect(user.termsVersion).toBe(LEGAL_VERSION);
    expect(user.termsAcceptedAt).not.toBeNull();
  });

  it("quem já aceitou os termos não precisa aceitar de novo", async () => {
    const owner = await ownerWithPassword();
    const { token } = await createPasswordToken(owner.id, "RESET");
    await resetPasswordWithToken({ token, password: "nova-senha-123" });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: owner.id } });
    expect(user.termsAcceptedAt).toEqual(owner.termsAcceptedAt);
  });
});

describe("changePassword", () => {
  it("troca com a senha atual correta", async () => {
    const owner = await ownerWithPassword("senha-antiga-123");
    await changePassword({ userId: owner.id, currentPassword: "senha-antiga-123", newPassword: "nova-senha-123", confirmation: "nova-senha-123" });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: owner.id } });
    expect(await verifyPassword("nova-senha-123", user.passwordHash)).toBe(true);
    expect(user.passwordChangedAt).not.toBeNull();
  });

  it("recusa senha atual errada", async () => {
    const owner = await ownerWithPassword("senha-antiga-123");
    await expect(
      changePassword({ userId: owner.id, currentPassword: "errada", newPassword: "nova-senha-123", confirmation: "nova-senha-123" })
    ).rejects.toMatchObject({ code: "WRONG_PASSWORD" });
  });

  it("recusa nova senha fraca", async () => {
    const owner = await ownerWithPassword("senha-antiga-123");
    await expect(
      changePassword({ userId: owner.id, currentPassword: "senha-antiga-123", newPassword: "curta", confirmation: "curta" })
    ).rejects.toMatchObject({ code: "WEAK_PASSWORD" });
  });
});

describe("termos em versão antiga", () => {
  it("conta que aceitou uma versão anterior precisa aceitar a atual ao redefinir", async () => {
    const owner = await ownerWithPassword();
    await prisma.user.update({ where: { id: owner.id }, data: { termsVersion: "2020-01-01" } });
    const { token } = await createPasswordToken(owner.id, "RESET");
    await expect(resetPasswordWithToken({ token, password: "nova-senha-123" })).rejects.toMatchObject({ code: "TERMS_REQUIRED" });
    await resetPasswordWithToken({ token, password: "nova-senha-123", acceptTerms: true });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).termsVersion).toBe(LEGAL_VERSION);
  });
});
