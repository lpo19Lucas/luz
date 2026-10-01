/**
 * Teste de integração — bate no Postgres real do serviço `postgres_test`
 * (docker-compose.yml). Rodar com `docker compose exec app npm run test:integration`.
 *
 * Cobre as validações centralizadas em `booking.ts` (Fase A do roadmap de
 * outubro) que as rotas sozinhas não cobriam: profissional precisa fazer o
 * serviço, horário precisa estar na grade de `getAvailableSlots`, cliente
 * banido é recusado, e cada operação grava o `AppointmentEvent` certo.
 */
import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon, futureSlotTime } from "@tests/integration/helpers";
import {
  createAppointment,
  cancelAppointmentByToken,
  cancelAppointmentById,
  confirmPresenceByToken,
  rescheduleAppointmentByToken,
  BookingError,
} from "@/lib/booking";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("createAppointment", () => {
  it("recusa profissional que não faz o serviço", async () => {
    const { salon, service } = await createTestSalon();
    const outroProfissional = await prisma.professional.create({
      data: { salonId: salon.id, name: "Sem vínculo com o serviço" },
    });

    await expect(
      createAppointment({
        salonSlug: salon.slug,
        professionalId: outroProfissional.id,
        serviceId: service.id,
        clientName: "Cliente",
        clientPhone: "11999990000",
        startAt: futureSlotTime(24),
        wantsToPayNow: false,
        source: "ONLINE",
        actor: "CLIENT",
      })
    ).rejects.toThrow(new BookingError("INVALID_PROFESSIONAL"));
  });

  it("recusa profissional inativo", async () => {
    const { salon, professional, service } = await createTestSalon();
    await prisma.professional.update({ where: { id: professional.id }, data: { active: false } });

    await expect(
      createAppointment({
        salonSlug: salon.slug,
        professionalId: professional.id,
        serviceId: service.id,
        clientName: "Cliente",
        clientPhone: "11999990000",
        startAt: futureSlotTime(24),
        wantsToPayNow: false,
        source: "ONLINE",
        actor: "CLIENT",
      })
    ).rejects.toThrow(new BookingError("INVALID_PROFESSIONAL"));
  });

  it("recusa horário que não está na grade de getAvailableSlots (source ONLINE)", async () => {
    const { salon, professional, service } = await createTestSalon();
    // 7 minutos não cai em nenhum múltiplo de 20 — nunca é oferecido pela grade.
    const startAt = futureSlotTime(24);
    startAt.setUTCMinutes(startAt.getUTCMinutes() + 7);

    await expect(
      createAppointment({
        salonSlug: salon.slug,
        professionalId: professional.id,
        serviceId: service.id,
        clientName: "Cliente",
        clientPhone: "11999990000",
        startAt,
        wantsToPayNow: false,
        source: "ONLINE",
        actor: "CLIENT",
      })
    ).rejects.toThrow(new BookingError("SLOT_UNAVAILABLE"));
  });

  it("permite horário fora da grade quando a origem é OWNER (encaixe livre)", async () => {
    const { salon, professional, service } = await createTestSalon();
    const startAt = futureSlotTime(24);
    startAt.setUTCMinutes(startAt.getUTCMinutes() + 7);

    const { appointment } = await createAppointment({
      salonSlug: salon.slug,
      professionalId: professional.id,
      serviceId: service.id,
      clientName: "Cliente",
      clientPhone: "11999990000",
      startAt,
      wantsToPayNow: false,
      source: "OWNER",
      actor: "OWNER",
    });

    expect(appointment.source).toBe("OWNER");
  });

  it("recusa cliente banido com mensagem neutra", async () => {
    const { salon, professional, service } = await createTestSalon();
    await prisma.client.create({
      data: { salonId: salon.id, name: "Banido", phone: "11999990000", bannedAt: new Date(), banReason: "teste" },
    });

    await expect(
      createAppointment({
        salonSlug: salon.slug,
        professionalId: professional.id,
        serviceId: service.id,
        clientName: "Cliente",
        clientPhone: "(11) 99999-0000", // telefone com formatação — tem que normalizar antes de comparar
        startAt: futureSlotTime(24),
        wantsToPayNow: false,
        source: "ONLINE",
        actor: "CLIENT",
      })
    ).rejects.toThrow(new BookingError("CLIENT_BANNED"));
  });

  it("normaliza o telefone antes do upsert do cliente", async () => {
    const { salon, professional, service } = await createTestSalon();

    await createAppointment({
      salonSlug: salon.slug,
      professionalId: professional.id,
      serviceId: service.id,
      clientName: "Cliente",
      clientPhone: "(11) 99999-0000",
      startAt: futureSlotTime(24),
      wantsToPayNow: false,
      source: "ONLINE",
      actor: "CLIENT",
    });

    const client = await prisma.client.findUniqueOrThrow({
      where: { salonId_phone: { salonId: salon.id, phone: "11999990000" } },
    });
    expect(client.phone).toBe("11999990000");
  });

  it("grava um AppointmentEvent CREATED com o ator certo", async () => {
    const { salon, professional, service } = await createTestSalon();

    const { appointment } = await createAppointment({
      salonSlug: salon.slug,
      professionalId: professional.id,
      serviceId: service.id,
      clientName: "Cliente",
      clientPhone: "11999990000",
      startAt: futureSlotTime(24),
      wantsToPayNow: false,
      source: "ONLINE",
      actor: "CLIENT",
    });

    const events = await prisma.appointmentEvent.findMany({ where: { appointmentId: appointment.id } });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("CREATED");
    expect(events[0].actor).toBe("CLIENT");
  });
});

describe("cancelAppointmentByToken", () => {
  it("grava um AppointmentEvent CANCELLED", async () => {
    const { salon, professional, service } = await createTestSalon();
    const { appointment } = await createAppointment({
      salonSlug: salon.slug,
      professionalId: professional.id,
      serviceId: service.id,
      clientName: "Cliente",
      clientPhone: "11999990000",
      startAt: futureSlotTime(24),
      wantsToPayNow: false,
      source: "ONLINE",
      actor: "CLIENT",
    });

    await cancelAppointmentByToken({ accessToken: appointment.accessToken, actor: "CLIENT" });

    const events = await prisma.appointmentEvent.findMany({
      where: { appointmentId: appointment.id, type: "CANCELLED" },
    });
    expect(events).toHaveLength(1);
    expect(events[0].actor).toBe("CLIENT");
  });
});

describe("cancelAppointmentById", () => {
  it("cancela um agendamento de outro salão escopado por salonId", async () => {
    const { salon, professional, service } = await createTestSalon();
    const { salon: outroSalon } = await createTestSalon();
    const { appointment } = await createAppointment({
      salonSlug: salon.slug,
      professionalId: professional.id,
      serviceId: service.id,
      clientName: "Cliente",
      clientPhone: "11999990000",
      startAt: futureSlotTime(24),
      wantsToPayNow: false,
      source: "OWNER",
      actor: "OWNER",
    });

    await expect(
      cancelAppointmentById({ salonId: outroSalon.id, appointmentId: appointment.id, actor: "OWNER" })
    ).rejects.toThrow(new BookingError("NOT_FOUND"));

    await cancelAppointmentById({ salonId: salon.id, appointmentId: appointment.id, actor: "OWNER" });
    const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(updated.status).toBe("CANCELLED");
  });
});

describe("confirmPresenceByToken", () => {
  it("grava um AppointmentEvent PRESENCE_CONFIRMED", async () => {
    const { salon, professional, service } = await createTestSalon();
    const { appointment } = await createAppointment({
      salonSlug: salon.slug,
      professionalId: professional.id,
      serviceId: service.id,
      clientName: "Cliente",
      clientPhone: "11999990000",
      startAt: futureSlotTime(24),
      wantsToPayNow: false,
      source: "ONLINE",
      actor: "CLIENT",
    });

    await confirmPresenceByToken(appointment.accessToken);

    const events = await prisma.appointmentEvent.findMany({
      where: { appointmentId: appointment.id, type: "PRESENCE_CONFIRMED" },
    });
    expect(events).toHaveLength(1);
  });
});

describe("rescheduleAppointmentByToken", () => {
  it("grava um AppointmentEvent RESCHEDULED com o horário antigo e o novo", async () => {
    const { salon, professional, service } = await createTestSalon();
    const { appointment } = await createAppointment({
      salonSlug: salon.slug,
      professionalId: professional.id,
      serviceId: service.id,
      clientName: "Cliente",
      clientPhone: "11999990000",
      startAt: futureSlotTime(24),
      wantsToPayNow: false,
      source: "ONLINE",
      actor: "CLIENT",
    });

    const newStartAt = futureSlotTime(48);
    await rescheduleAppointmentByToken({
      accessToken: appointment.accessToken,
      newStartAt,
      actor: "CLIENT",
    });

    const events = await prisma.appointmentEvent.findMany({
      where: { appointmentId: appointment.id, type: "RESCHEDULED" },
    });
    expect(events).toHaveLength(1);
    expect(events[0].previousStartAt?.getTime()).toBe(appointment.startAt.getTime());
    expect(events[0].newStartAt?.getTime()).toBe(newStartAt.getTime());
  });

  it("recusa horário fora da grade quando o ator é CLIENT", async () => {
    const { salon, professional, service } = await createTestSalon();
    const { appointment } = await createAppointment({
      salonSlug: salon.slug,
      professionalId: professional.id,
      serviceId: service.id,
      clientName: "Cliente",
      clientPhone: "11999990000",
      startAt: futureSlotTime(24),
      wantsToPayNow: false,
      source: "ONLINE",
      actor: "CLIENT",
    });

    const newStartAt = futureSlotTime(48);
    newStartAt.setUTCMinutes(newStartAt.getUTCMinutes() + 7);

    await expect(
      rescheduleAppointmentByToken({ accessToken: appointment.accessToken, newStartAt, actor: "CLIENT" })
    ).rejects.toThrow(new BookingError("SLOT_UNAVAILABLE"));
  });
});
