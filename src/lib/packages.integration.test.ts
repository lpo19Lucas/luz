/**
 * Teste de integração — bate no Postgres real do serviço `postgres_test`
 * (docker-compose.yml). Rodar com `docker compose exec app npm run test:integration`.
 *
 * Cobre o fluxo de pacotes/assinaturas de cliente: venda manual, reserva
 * pública + confirmação do dono, consumo no agendamento (SERVICE_CREDITS e
 * CASH_CREDIT), expiração e cliente banido.
 */
import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon, futureSlotTime } from "@tests/integration/helpers";
import {
  purchasePackageManually,
  reservePackagePublic,
  confirmPackagePayment,
  findUsablePackageForAppointment,
  PackageError,
} from "@/lib/packages";
import { createAppointment, BookingError } from "@/lib/booking";
import { getClientStats } from "@/lib/clientStats";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createServiceCreditsDef(salonId: string, serviceId: string, credits = 4) {
  return prisma.packageDefinition.create({
    data: {
      salonId,
      name: `${credits} cortes`,
      type: "SERVICE_CREDITS",
      serviceId,
      credits,
      priceCents: 15000,
      validityDays: 30,
    },
  });
}

async function createCashCreditDef(salonId: string, valueCents = 20000) {
  return prisma.packageDefinition.create({
    data: {
      salonId,
      name: "Crédito R$ 200",
      type: "CASH_CREDIT",
      valueCents,
      priceCents: 18000,
      validityDays: 30,
    },
  });
}

describe("venda manual (dono)", () => {
  it("ativa na hora com os créditos da definição", async () => {
    const { salon, service } = await createTestSalon();
    const def = await createServiceCreditsDef(salon.id, service.id, 4);
    const client = await prisma.client.create({ data: { salonId: salon.id, name: "Ana", phone: "11999990000" } });

    const purchased = await purchasePackageManually({
      salonId: salon.id,
      clientId: client.id,
      packageDefinitionId: def.id,
    });

    expect(purchased.status).toBe("ACTIVE");
    expect(purchased.remainingCredits).toBe(4);
    expect(purchased.activatedAt).not.toBeNull();
    expect(purchased.expiresAt).not.toBeNull();
  });

  it("recusa cliente banido", async () => {
    const { salon, service } = await createTestSalon();
    const def = await createServiceCreditsDef(salon.id, service.id);
    const client = await prisma.client.create({
      data: { salonId: salon.id, name: "Banido", phone: "11999990001", bannedAt: new Date() },
    });

    await expect(
      purchasePackageManually({ salonId: salon.id, clientId: client.id, packageDefinitionId: def.id })
    ).rejects.toThrow(PackageError);
  });
});

describe("reserva pública + confirmação do dono", () => {
  it("fica PENDING_PAYMENT até o dono confirmar, e só então define validade", async () => {
    const { salon, service } = await createTestSalon();
    const def = await createServiceCreditsDef(salon.id, service.id);

    const reserved = await reservePackagePublic({
      salonSlug: salon.slug,
      packageDefinitionId: def.id,
      clientName: "Bia",
      clientPhone: "11999990002",
    });
    expect(reserved.status).toBe("PENDING_PAYMENT");
    expect(reserved.activatedAt).toBeNull();
    expect(reserved.remainingCredits).toBeNull();

    const confirmed = await confirmPackagePayment({ salonId: salon.id, clientPackageId: reserved.id });
    expect(confirmed.status).toBe("ACTIVE");
    expect(confirmed.remainingCredits).toBe(4);
    expect(confirmed.expiresAt).not.toBeNull();
  });

  it("cliente banido não consegue reservar", async () => {
    const { salon, service } = await createTestSalon();
    const def = await createServiceCreditsDef(salon.id, service.id);
    await prisma.client.create({
      data: { salonId: salon.id, name: "Banido", phone: "11999990003", bannedAt: new Date() },
    });

    await expect(
      reservePackagePublic({
        salonSlug: salon.slug,
        packageDefinitionId: def.id,
        clientName: "Banido",
        clientPhone: "11999990003",
      })
    ).rejects.toThrow(PackageError);
  });
});

describe("consumo no agendamento", () => {
  it("SERVICE_CREDITS decrementa 1 crédito e marca coveredByPackage", async () => {
    const { salon, professional, service } = await createTestSalon();
    const def = await createServiceCreditsDef(salon.id, service.id, 4);
    const client = await prisma.client.create({ data: { salonId: salon.id, name: "Ana", phone: "11999990004" } });
    const pkg = await purchasePackageManually({
      salonId: salon.id,
      clientId: client.id,
      packageDefinitionId: def.id,
    });

    const { appointment } = await createAppointment({
      salonSlug: salon.slug,
      professionalId: professional.id,
      serviceId: service.id,
      clientName: "Ana",
      clientPhone: "11999990004",
      startAt: futureSlotTime(24),
      wantsToPayNow: false,
      source: "ONLINE",
      actor: "CLIENT",
      usePackageId: pkg.id,
    });

    expect(appointment.coveredByPackage).toBe(true);
    const updated = await prisma.clientPackage.findUniqueOrThrow({ where: { id: pkg.id } });
    expect(updated.remainingCredits).toBe(3);
    const consumption = await prisma.packageConsumption.findUnique({ where: { appointmentId: appointment.id } });
    expect(consumption?.creditsUsed).toBe(1);
  });

  it("CASH_CREDIT decrementa o preço do serviço", async () => {
    const { salon, professional, service } = await createTestSalon(); // serviço = 5000 centavos
    const def = await createCashCreditDef(salon.id, 20000);
    const client = await prisma.client.create({ data: { salonId: salon.id, name: "Bia", phone: "11999990005" } });
    const pkg = await purchasePackageManually({
      salonId: salon.id,
      clientId: client.id,
      packageDefinitionId: def.id,
    });

    await createAppointment({
      salonSlug: salon.slug,
      professionalId: professional.id,
      serviceId: service.id,
      clientName: "Bia",
      clientPhone: "11999990005",
      startAt: futureSlotTime(24),
      wantsToPayNow: false,
      source: "ONLINE",
      actor: "CLIENT",
      usePackageId: pkg.id,
    });

    const updated = await prisma.clientPackage.findUniqueOrThrow({ where: { id: pkg.id } });
    expect(updated.remainingValueCents).toBe(20000 - service.priceCents);
  });

  it("não encontra pacote expirado", async () => {
    const { salon, service } = await createTestSalon();
    const def = await createServiceCreditsDef(salon.id, service.id);
    const client = await prisma.client.create({ data: { salonId: salon.id, name: "Ana", phone: "11999990006" } });
    const pkg = await purchasePackageManually({
      salonId: salon.id,
      clientId: client.id,
      packageDefinitionId: def.id,
    });
    await prisma.clientPackage.update({
      where: { id: pkg.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const usable = await findUsablePackageForAppointment({
      salonId: salon.id,
      clientId: client.id,
      serviceId: service.id,
      priceCents: service.priceCents,
    });
    expect(usable).toBeNull();
  });

  it("sem créditos restantes não é usável, e agendar sem pacote cobra normal", async () => {
    const { salon, professional, service } = await createTestSalon();
    const def = await createServiceCreditsDef(salon.id, service.id, 1);
    const client = await prisma.client.create({ data: { salonId: salon.id, name: "Ana", phone: "11999990007" } });
    const pkg = await purchasePackageManually({
      salonId: salon.id,
      clientId: client.id,
      packageDefinitionId: def.id,
    });

    await createAppointment({
      salonSlug: salon.slug,
      professionalId: professional.id,
      serviceId: service.id,
      clientName: "Ana",
      clientPhone: "11999990007",
      startAt: futureSlotTime(24),
      wantsToPayNow: false,
      source: "ONLINE",
      actor: "CLIENT",
      usePackageId: pkg.id,
    });

    const usable = await findUsablePackageForAppointment({
      salonId: salon.id,
      clientId: client.id,
      serviceId: service.id,
      priceCents: service.priceCents,
    });
    expect(usable).toBeNull();

    const second = await createAppointment({
      salonSlug: salon.slug,
      professionalId: professional.id,
      serviceId: service.id,
      clientName: "Ana",
      clientPhone: "11999990007",
      startAt: futureSlotTime(48),
      wantsToPayNow: false,
      source: "ONLINE",
      actor: "CLIENT",
    });
    expect(second.appointment.coveredByPackage).toBe(false);
  });

  it("usePackageId inválido (não usável) rejeita o agendamento com PACKAGE_NOT_USABLE", async () => {
    const { salon, professional, service } = await createTestSalon();
    const client = await prisma.client.create({ data: { salonId: salon.id, name: "Ana", phone: "11999990008" } });

    await expect(
      createAppointment({
        salonSlug: salon.slug,
        professionalId: professional.id,
        serviceId: service.id,
        clientName: "Ana",
        clientPhone: "11999990008",
        startAt: futureSlotTime(24),
        wantsToPayNow: false,
        source: "ONLINE",
        actor: "CLIENT",
        usePackageId: "pacote-inexistente",
      })
    ).rejects.toMatchObject({ code: "PACKAGE_NOT_USABLE" } satisfies Partial<BookingError>);
  });
});

describe("clientStats exclui atendimento coberto por pacote da receita", () => {
  it("conta a visita mas não soma no totalSpentCents", async () => {
    const { salon, professional, service } = await createTestSalon();
    const def = await createServiceCreditsDef(salon.id, service.id, 4);
    const client = await prisma.client.create({ data: { salonId: salon.id, name: "Ana", phone: "11999990009" } });
    const pkg = await purchasePackageManually({
      salonId: salon.id,
      clientId: client.id,
      packageDefinitionId: def.id,
    });

    const { appointment } = await createAppointment({
      salonSlug: salon.slug,
      professionalId: professional.id,
      serviceId: service.id,
      clientName: "Ana",
      clientPhone: "11999990009",
      startAt: futureSlotTime(-1), // já passou, pra poder marcar COMPLETED
      wantsToPayNow: false,
      source: "OWNER",
      actor: "OWNER",
      usePackageId: pkg.id,
    });
    await prisma.appointment.update({ where: { id: appointment.id }, data: { status: "COMPLETED" } });

    const stats = await getClientStats(salon.id, client.id);
    expect(stats.visitCount).toBe(1);
    expect(stats.totalSpentCents).toBe(0);
  });
});
