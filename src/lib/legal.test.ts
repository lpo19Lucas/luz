import { getLegalEntity, isLegalEntityConfigured } from "./legal";
import { termsOfUse, privacyPolicy, licenseAgreement } from "./legalTexts";
import { validateNewPassword, MIN_PASSWORD_LENGTH } from "./passwordPolicy";

const LEGAL_ENV = [
  "LEGAL_COMPANY_NAME",
  "LEGAL_CNPJ",
  "LEGAL_ADDRESS",
  "LEGAL_CONTACT_EMAIL",
  "LEGAL_DPO_NAME",
  "LEGAL_DPO_EMAIL",
  "LEGAL_FORUM_CITY",
];

afterEach(() => {
  for (const name of LEGAL_ENV) delete process.env[name];
});

describe("dados jurídicos", () => {
  it("sem env vars, mostra o marcador [A DEFINIR] (nunca um dado inventado)", () => {
    expect(getLegalEntity().cnpj).toBe("[A DEFINIR]");
    expect(isLegalEntityConfigured()).toBe(false);
    expect(JSON.stringify(termsOfUse())).toContain("[A DEFINIR]");
  });

  it("com as env vars preenchidas, o CNPJ aparece nos três documentos", () => {
    process.env.LEGAL_COMPANY_NAME = "Luz Tecnologia LTDA";
    process.env.LEGAL_CNPJ = "12.345.678/0001-90";
    process.env.LEGAL_ADDRESS = "Rua X, 1 — São Paulo/SP";
    process.env.LEGAL_CONTACT_EMAIL = "contato@luz.app";
    process.env.LEGAL_DPO_NAME = "Fulano";
    process.env.LEGAL_FORUM_CITY = "São Paulo/SP";

    expect(isLegalEntityConfigured()).toBe(true);
    // DPO sem e-mail próprio cai no e-mail de contato.
    expect(getLegalEntity().dpoEmail).toBe("contato@luz.app");
    for (const doc of [termsOfUse(), privacyPolicy(), licenseAgreement()]) {
      const text = JSON.stringify(doc);
      expect(text).toContain("12.345.678/0001-90");
      expect(text).not.toContain("[A DEFINIR]");
    }
  });

  it("a política de privacidade cobre os pontos obrigatórios da LGPD", () => {
    const text = JSON.stringify(privacyPolicy());
    for (const term of ["Controlador", "Operadora", "art. 18", "Encarregado", "ANPD", "base legal"]) {
      expect(text).toContain(term);
    }
  });

  it("o contrato tem cláusula de tratamento de dados (operador)", () => {
    const titles = licenseAgreement().sections.map((s) => s.title);
    expect(titles).toContain("Proteção de dados pessoais (LGPD)");
  });
});

describe("validateNewPassword", () => {
  it("exige o tamanho mínimo", () => {
    expect(validateNewPassword("a".repeat(MIN_PASSWORD_LENGTH - 1))).toMatch(/pelo menos/);
    expect(validateNewPassword("a".repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });

  it("confere a confirmação quando informada", () => {
    expect(validateNewPassword("senhaforte1", "senhaforte2")).toBe("As senhas não conferem.");
    expect(validateNewPassword("senhaforte1", "senhaforte1")).toBeNull();
  });
});

describe("notificações e equipe nos documentos", () => {
  it("a política cobre notificações, service worker e contas de profissional", () => {
    const text = JSON.stringify(privacyPolicy());
    expect(text).toContain("Ativar notificações");
    expect(text).toContain("service worker");
    expect(text).toContain("Profissionais com acesso");
    expect(JSON.stringify(termsOfUse())).toContain("Profissional com acesso");
  });
});
