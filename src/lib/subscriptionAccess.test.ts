import { getSubscriptionAccess } from "./subscriptionAccess";

const DAY = 24 * 60 * 60_000;

describe("getSubscriptionAccess", () => {
  it("retorna BLOCKED sem assinatura", () => {
    expect(getSubscriptionAccess(null)).toBe("BLOCKED");
  });

  it("retorna BLOCKED pra assinatura cancelada, mesmo com período ainda válido", () => {
    const now = new Date();
    expect(
      getSubscriptionAccess(
        { status: "CANCELLED", trialEndsAt: new Date(now.getTime() + DAY), currentPeriodEnd: null },
        now
      )
    ).toBe("BLOCKED");
  });

  it("TRIAL dentro do prazo é OK", () => {
    const now = new Date();
    expect(
      getSubscriptionAccess(
        { status: "TRIAL", trialEndsAt: new Date(now.getTime() + DAY), currentPeriodEnd: null },
        now
      )
    ).toBe("OK");
  });

  it("TRIAL vencido há 1 dia está em carência (limite é 5 dias)", () => {
    const now = new Date();
    expect(
      getSubscriptionAccess(
        { status: "TRIAL", trialEndsAt: new Date(now.getTime() - DAY), currentPeriodEnd: null },
        now
      )
    ).toBe("GRACE");
  });

  it("TRIAL vencido há exatamente 5 dias ainda está em carência (inclusive)", () => {
    const now = new Date();
    expect(
      getSubscriptionAccess(
        { status: "TRIAL", trialEndsAt: new Date(now.getTime() - 5 * DAY), currentPeriodEnd: null },
        now
      )
    ).toBe("GRACE");
  });

  it("TRIAL vencido há mais de 5 dias é BLOCKED", () => {
    const now = new Date();
    expect(
      getSubscriptionAccess(
        { status: "TRIAL", trialEndsAt: new Date(now.getTime() - 6 * DAY), currentPeriodEnd: null },
        now
      )
    ).toBe("BLOCKED");
  });

  it("ACTIVE usa currentPeriodEnd, não trialEndsAt", () => {
    const now = new Date();
    expect(
      getSubscriptionAccess(
        {
          status: "ACTIVE",
          trialEndsAt: new Date(now.getTime() - 100 * DAY), // vencido há muito, mas é TRIAL — ignorado
          currentPeriodEnd: new Date(now.getTime() + DAY),
        },
        now
      )
    ).toBe("OK");
  });

  it("ACTIVE vencido entra em carência e depois é BLOCKED", () => {
    const now = new Date();
    expect(
      getSubscriptionAccess(
        { status: "ACTIVE", trialEndsAt: now, currentPeriodEnd: new Date(now.getTime() - DAY) },
        now
      )
    ).toBe("GRACE");
    expect(
      getSubscriptionAccess(
        { status: "ACTIVE", trialEndsAt: now, currentPeriodEnd: new Date(now.getTime() - 6 * DAY) },
        now
      )
    ).toBe("BLOCKED");
  });

  it("ACTIVE sem currentPeriodEnd definido não bloqueia", () => {
    const now = new Date();
    expect(
      getSubscriptionAccess({ status: "ACTIVE", trialEndsAt: now, currentPeriodEnd: null }, now)
    ).toBe("OK");
  });
});
