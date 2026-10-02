/**
 * Teste de integração — bate no Postgres real do serviço `postgres_test`
 * (docker-compose.yml). Rodar com `docker compose exec app npm run test:integration`.
 *
 * Cobre a recorrência de AgendaBlock (F4) através de getAvailableSlots —
 * ONCE, DAILY e WEEKLY, bloqueio de um profissional vs do salão inteiro, e
 * faixa de horário parcial vs dia inteiro.
 */
import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon, futureSlotTime } from "@tests/integration/helpers";
import { getAvailableSlots } from "@/lib/slots";
import { salonWeekday, salonMidnightUTC } from "@/lib/timezone";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("AgendaBlock via getAvailableSlots", () => {
  it("ONCE bloqueia o dia inteiro só naquela data", async () => {
    const { salon, professional, service } = await createTestSalon();
    const blockedDay = futureSlotTime(24);
    const otherDay = futureSlotTime(48);

    await prisma.agendaBlock.create({
      data: {
        salonId: salon.id,
        professionalId: professional.id,
        recurrence: "ONCE",
        date: salonMidnightUTC(blockedDay),
        reason: "Folga",
      },
    });

    const blockedSlots = await getAvailableSlots(professional.id, service.id, blockedDay);
    const otherSlots = await getAvailableSlots(professional.id, service.id, otherDay);

    expect(blockedSlots).toHaveLength(0);
    expect(otherSlots.length).toBeGreaterThan(0);
  });

  it("DAILY bloqueia todo dia dentro de startsOn/endsOn", async () => {
    const { salon, professional, service } = await createTestSalon();
    const before = futureSlotTime(24); // antes do início do bloqueio — continua livre
    const inside = futureSlotTime(72); // depois de startsOn — bloqueado

    await prisma.agendaBlock.create({
      data: {
        salonId: salon.id,
        professionalId: professional.id,
        recurrence: "DAILY",
        startsOn: salonMidnightUTC(futureSlotTime(48)),
        reason: "Fechado por reforma",
      },
    });

    const slotsInside = await getAvailableSlots(professional.id, service.id, inside);
    const slotsBefore = await getAvailableSlots(professional.id, service.id, before);

    expect(slotsInside).toHaveLength(0);
    expect(slotsBefore.length).toBeGreaterThan(0);
  });

  it("WEEKLY bloqueia só o dia da semana configurado", async () => {
    const { salon, professional, service } = await createTestSalon();
    const target = futureSlotTime(24);
    const targetWeekday = salonWeekday(target);
    const nextWeekSameDay = new Date(target.getTime() + 7 * 24 * 60 * 60_000);
    const otherWeekday = new Date(target.getTime() + 24 * 60 * 60_000); // dia seguinte, weekday diferente

    await prisma.agendaBlock.create({
      data: {
        salonId: salon.id,
        professionalId: professional.id,
        recurrence: "WEEKLY",
        weekday: targetWeekday,
        reason: "Folga semanal",
      },
    });

    const slotsTarget = await getAvailableSlots(professional.id, service.id, target);
    const slotsNextWeek = await getAvailableSlots(professional.id, service.id, nextWeekSameDay);
    const slotsOtherWeekday = await getAvailableSlots(professional.id, service.id, otherWeekday);

    expect(slotsTarget).toHaveLength(0);
    expect(slotsNextWeek).toHaveLength(0); // WEEKLY sem startsOn/endsOn vale sempre
    expect(slotsOtherWeekday.length).toBeGreaterThan(0);
  });

  it("bloqueio do salão inteiro (professionalId null) vale pra todos os profissionais", async () => {
    const { salon, professional, service } = await createTestSalon();
    const otherProfessional = await prisma.professional.create({
      data: { salonId: salon.id, name: "Outro Profissional" },
    });
    await prisma.availability.createMany({
      data: Array.from({ length: 7 }, (_, weekday) => ({
        professionalId: otherProfessional.id,
        weekday,
        startTime: "00:00",
        endTime: "23:59",
      })),
    });
    const holiday = futureSlotTime(24);

    await prisma.agendaBlock.create({
      data: {
        salonId: salon.id,
        professionalId: null,
        recurrence: "ONCE",
        date: salonMidnightUTC(holiday),
        reason: "Feriado nacional",
      },
    });

    expect(await getAvailableSlots(professional.id, service.id, holiday)).toHaveLength(0);
    expect(await getAvailableSlots(otherProfessional.id, service.id, holiday)).toHaveLength(0);
  });

  it("bloqueio com faixa de horário só remove os slots dessa faixa", async () => {
    const { salon, professional, service } = await createTestSalon();
    const day = futureSlotTime(24);

    await prisma.agendaBlock.create({
      data: {
        salonId: salon.id,
        professionalId: professional.id,
        recurrence: "ONCE",
        date: salonMidnightUTC(day),
        startTime: "12:00",
        endTime: "13:00",
      },
    });

    const slots = await getAvailableSlots(professional.id, service.id, day);
    expect(slots.length).toBeGreaterThan(0);
    const insideBlockedRange = slots.some((s) => {
      const hour = Number(
        s.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false })
      );
      return hour === 12;
    });
    expect(insideBlockedRange).toBe(false);
  });
});
