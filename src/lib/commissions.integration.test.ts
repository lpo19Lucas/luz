/**
 * Teste de integração — bate no Postgres real do serviço `postgres_test`
 * (docker-compose.yml). Rodar com `docker compose exec app npm run test:integration`.
 *
 * Cobre o cálculo de comissão por profissional: só COMPLETED, por período,
 * profissional sem % configurada aparece com comissão null.
 */
import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon, futureSlotTime } from "@tests/integration/helpers";
import { getCommissionReport } from "@/lib/commissions";
import { createAppointment } from "@/lib/booking";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function completedAppointment(
  salon: Awaited<ReturnType<typeof createTestSalon>>,
  phone: string,
  hoursFromNow: number
) {
  const { appointment } = await createAppointment({
    salonSlug: salon.salon.slug,
    professionalId: salon.professional.id,
    serviceId: salon.service.id,
    clientName: "Cliente",
    clientPhone: phone,
    startAt: futureSlotTime(hoursFromNow),
    wantsToPayNow: false,
    source: "OWNER",
    actor: "OWNER",
  });
  return prisma.appointment.update({ where: { id: appointment.id }, data: { status: "COMPLETED" } });
}

describe("getCommissionReport", () => {
  it("calcula comissão só sobre COMPLETED, pra profissional com % configurada", async () => {
    const salon = await createTestSalon();
    await prisma.professional.update({ where: { id: salon.professional.id }, data: { commissionPercent: 40 } });
    await completedAppointment(salon, "11999992001", -2);
    // CONFIRMED (não concluído) não deve entrar na conta.
    await createAppointment({
      salonSlug: salon.salon.slug,
      professionalId: salon.professional.id,
      serviceId: salon.service.id,
      clientName: "Outro",
      clientPhone: "11999992002",
      startAt: futureSlotTime(24),
      wantsToPayNow: false,
      source: "ONLINE",
      actor: "CLIENT",
    });

    const report = await getCommissionReport({ salonId: salon.salon.id });
    expect(report).toHaveLength(1);
    expect(report[0].appointmentsCount).toBe(1);
    expect(report[0].totalRevenueCents).toBe(salon.service.priceCents);
    expect(report[0].commissionCents).toBe(Math.round(salon.service.priceCents * 0.4));
  });

  it("profissional sem commissionPercent aparece com comissão null", async () => {
    const salon = await createTestSalon();
    await completedAppointment(salon, "11999992003", -2);

    const report = await getCommissionReport({ salonId: salon.salon.id });
    expect(report).toHaveLength(1);
    expect(report[0].commissionPercent).toBeNull();
    expect(report[0].commissionCents).toBeNull();
  });

  it("período sem atendimento retorna lista vazia", async () => {
    const salon = await createTestSalon();
    await completedAppointment(salon, "11999992004", -2);

    const report = await getCommissionReport({
      salonId: salon.salon.id,
      from: new Date(Date.now() + 30 * 24 * 60 * 60_000),
    });
    expect(report).toHaveLength(0);
  });
});
