import { needsTermsAcceptance } from "./termsAcceptance";
import { LEGAL_VERSION } from "./legal";

jest.mock("./prisma", () => ({ prisma: {} }));

describe("needsTermsAcceptance", () => {
  it("pede aceite de quem nunca aceitou ou aceitou versão anterior", () => {
    expect(needsTermsAcceptance({ termsVersion: null })).toBe(true);
    expect(needsTermsAcceptance({ termsVersion: "2020-01-01" })).toBe(true);
  });

  it("não pede de quem aceitou a versão atual", () => {
    expect(needsTermsAcceptance({ termsVersion: LEGAL_VERSION })).toBe(false);
  });
});
