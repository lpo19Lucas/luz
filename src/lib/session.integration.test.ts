/**
 * Roda no projeto "integration" (ambiente node) porque auth.ts importa jose e
 * next/headers — não precisa de banco.
 *
 * Cobre a regra que derruba sessões: conta bloqueada pelo admin ou senha
 * trocada depois da emissão do JWT.
 */
import { isSessionStillValid } from "@/lib/auth";

const changedAt = new Date("2026-10-06T12:00:00Z");
const changedAtSec = Math.floor(changedAt.getTime() / 1000);

describe("isSessionStillValid", () => {
  it("vale sem bloqueio e sem troca de senha", () => {
    expect(isSessionStillValid({ issuedAt: 1 }, { disabledAt: null, passwordChangedAt: null })).toBe(true);
  });

  it("cai se a conta foi bloqueada", () => {
    expect(isSessionStillValid({ issuedAt: changedAtSec }, { disabledAt: new Date(), passwordChangedAt: null })).toBe(false);
  });

  it("cai se emitida antes da troca de senha", () => {
    expect(isSessionStillValid({ issuedAt: changedAtSec - 10 }, { disabledAt: null, passwordChangedAt: changedAt })).toBe(false);
  });

  it("vale se emitida no mesmo segundo ou depois da troca (login logo após redefinir)", () => {
    expect(isSessionStillValid({ issuedAt: changedAtSec }, { disabledAt: null, passwordChangedAt: changedAt })).toBe(true);
    expect(isSessionStillValid({ issuedAt: changedAtSec + 5 }, { disabledAt: null, passwordChangedAt: changedAt })).toBe(true);
  });
});
