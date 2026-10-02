/**
 * Teste de integração — bate no Postgres real do serviço `postgres_test`
 * (docker-compose.yml). Rodar com `docker compose exec app npm run test:integration`.
 *
 * Cobre a regra de negócio mais sensível do MVP: prevenção de conflito de
 * horário (spec P0.6, ver arquitetura-modelo-de-dados.md seção 4).
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon, futureSlotTime } from "@tests/integration/helpers";
import { POST } from "./route";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function postAppointment(slug: string, body: Record<string, unknown>) {
  const req = new NextRequest("http://localhost/api/salons/x/appointments", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return POST(req, { params: Promise.resolve({ salonSlug: slug }) });
}

describe("POST /api/salons/[salonSlug]/appointments", () => {
  it("cria o agendamento e agenda os jobs de WhatsApp quando não há conflito", async () => {
    const { salon, professional, service } = await createTestSalon();
    const startAt = futureSlotTime(24).toISOString();

    const res = await postAppointment(salon.slug, {
      professionalId: professional.id,
      serviceId: service.id,
      clientName: "Cliente Um",
      clientPhone: "11999990000",
      startAt,
      wantsToPayNow: false,
    });

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.accessToken).toBeTruthy();

    const jobs = await prisma.whatsAppMessageJob.findMany({
      where: { appointmentId: json.id },
    });
    // BOOKING_CONFIRMATION + REMINDER + PRESENCE_CHECK (config habilitada por padrão no helper)
    expect(jobs.map((j) => j.type).sort()).toEqual(
      ["BOOKING_CONFIRMATION", "PRESENCE_CHECK", "REMINDER"].sort()
    );
  });

  it("não agenda job de PRESENCE_CHECK quando a confirmação de presença está desabilitada", async () => {
    const { salon, professional, service } = await createTestSalon({
      presenceConfirmationEnabled: false,
    });
    const startAt = futureSlotTime(24).toISOString();

    const res = await postAppointment(salon.slug, {
      professionalId: professional.id,
      serviceId: service.id,
      clientName: "Cliente Um",
      clientPhone: "11999990000",
      startAt,
      wantsToPayNow: false,
    });
    const json = await res.json();

    const jobs = await prisma.whatsAppMessageJob.findMany({
      where: { appointmentId: json.id },
    });
    expect(jobs.map((j) => j.type).sort()).toEqual(["BOOKING_CONFIRMATION", "REMINDER"].sort());
  });

  it("rejeita com 409 quando o horário já está ocupado pelo mesmo profissional", async () => {
    const { salon, professional, service } = await createTestSalon();
    const startAt = futureSlotTime(24).toISOString();

    const first = await postAppointment(salon.slug, {
      professionalId: professional.id,
      serviceId: service.id,
      clientName: "Cliente Um",
      clientPhone: "11999990000",
      startAt,
      wantsToPayNow: false,
    });
    expect(first.status).toBe(201);

    // Mesmo horário, mesmo profissional, cliente diferente.
    const second = await postAppointment(salon.slug, {
      professionalId: professional.id,
      serviceId: service.id,
      clientName: "Cliente Dois",
      clientPhone: "11988880000",
      startAt,
      wantsToPayNow: false,
    });

    expect(second.status).toBe(409);
  });

  it("permite dois agendamentos no mesmo horário se forem com profissionais diferentes", async () => {
    const { salon, professional, service } = await createTestSalon();
    const otherProfessional = await prisma.professional.create({
      data: { salonId: salon.id, name: "Outro Profissional" },
    });
    await prisma.serviceProfessional.create({
      data: { serviceId: service.id, professionalId: otherProfessional.id },
    });
    await prisma.availability.createMany({
      data: Array.from({ length: 7 }, (_, weekday) => ({
        professionalId: otherProfessional.id,
        weekday,
        startTime: "00:00",
        endTime: "23:59",
      })),
    });
    const startAt = futureSlotTime(24).toISOString();

    const first = await postAppointment(salon.slug, {
      professionalId: professional.id,
      serviceId: service.id,
      clientName: "Cliente Um",
      clientPhone: "11999990000",
      startAt,
      wantsToPayNow: false,
    });
    const second = await postAppointment(salon.slug, {
      professionalId: otherProfessional.id,
      serviceId: service.id,
      clientName: "Cliente Dois",
      clientPhone: "11988880000",
      startAt,
      wantsToPayNow: false,
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });

  it("upsert de cliente: mesmo telefone no mesmo salão não duplica o Client", async () => {
    const { salon, professional, service } = await createTestSalon();
    const startAt1 = futureSlotTime(24).toISOString();
    const startAt2 = futureSlotTime(48).toISOString();

    await postAppointment(salon.slug, {
      professionalId: professional.id,
      serviceId: service.id,
      clientName: "Cliente Um",
      clientPhone: "11999990000",
      startAt: startAt1,
      wantsToPayNow: false,
    });
    await postAppointment(salon.slug, {
      professionalId: professional.id,
      serviceId: service.id,
      clientName: "Cliente Um Atualizado",
      clientPhone: "11999990000",
      startAt: startAt2,
      wantsToPayNow: false,
    });

    const clients = await prisma.client.findMany({ where: { salonId: salon.id } });
    expect(clients).toHaveLength(1);
    expect(clients[0].name).toBe("Cliente Um Atualizado");
  });

  it("retorna 404 quando o salão não existe", async () => {
    const res = await postAppointment("salao-inexistente", {
      professionalId: "x",
      serviceId: "x",
      clientName: "Cliente",
      clientPhone: "11999990000",
      startAt: new Date().toISOString(),
      wantsToPayNow: false,
    });
    expect(res.status).toBe(404);
  });

  it("retorna 400 quando o serviço não pertence ao salão", async () => {
    const { salon, professional } = await createTestSalon();
    const { salon: outroSalon, service: servicoDeOutroSalao } = await createTestSalon();

    const res = await postAppointment(salon.slug, {
      professionalId: professional.id,
      serviceId: servicoDeOutroSalao.id,
      clientName: "Cliente",
      clientPhone: "11999990000",
      startAt: futureSlotTime(24).toISOString(),
      wantsToPayNow: false,
    });
    expect(res.status).toBe(400);
    expect(outroSalon.id).not.toBe(salon.id);
  });
});
