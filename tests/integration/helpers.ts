import { prisma } from "@/lib/prisma";

/**
 * Limpa todas as tabelas do banco de teste entre casos. TRUNCATE (não DELETE)
 * porque é mais rápido e reseta sequências — não tem problema de performance
 * aqui porque o banco de teste é sempre pequeno.
 */
export async function resetDb() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "whatsapp_message_jobs",
      "appointment_events",
      "product_reservations",
      "products",
      "message_templates",
      "appointments",
      "service_professionals",
      "availability_exceptions",
      "agenda_blocks",
      "availabilities",
      "clients",
      "services",
      "professionals",
      "presence_confirmation_configs",
      "subscriptions",
      "salons",
      "users"
    RESTART IDENTITY CASCADE;
  `);
}

/**
 * Monta o grafo mínimo (User -> Salon -> Professional -> Service) que toda
 * rota de agendamento precisa pra funcionar, pra não repetir isso em cada teste.
 */
export async function createTestSalon(
  overrides: { presenceConfirmationEnabled?: boolean } = {}
) {
  const owner = await prisma.user.create({
    data: {
      email: `dono-${Date.now()}-${Math.random()}@teste.com`,
      passwordHash: "hash-fake-nao-usado-em-teste",
      name: "Dono Teste",
    },
  });

  const salon = await prisma.salon.create({
    data: { name: "Salão Teste", slug: `salao-teste-${Date.now()}-${Math.random()}`, ownerId: owner.id },
  });

  const professional = await prisma.professional.create({
    data: { salonId: salon.id, name: "Profissional Teste" },
  });

  const service = await prisma.service.create({
    data: { salonId: salon.id, name: "Corte", durationMinutes: 30, priceCents: 5000 },
  });

  // Vínculo profissional <-> serviço e disponibilidade o dia inteiro em
  // todos os dias da semana: por padrão os testes não querem testar a grade
  // de horários, só o fluxo de agendamento em si (ver `booking.ts`).
  await prisma.serviceProfessional.create({
    data: { serviceId: service.id, professionalId: professional.id },
  });
  await prisma.availability.createMany({
    data: Array.from({ length: 7 }, (_, weekday) => ({
      professionalId: professional.id,
      weekday,
      startTime: "00:00",
      endTime: "23:59",
    })),
  });

  await prisma.presenceConfirmationConfig.create({
    data: {
      salonId: salon.id,
      enabled: overrides.presenceConfirmationEnabled ?? true,
      hoursBefore: 24,
    },
  });

  return { owner, salon, professional, service };
}

/**
 * Horário futuro alinhado à grade de 20 em 20 min de `getAvailableSlots`
 * (`src/lib/slots.ts`) — necessário desde que `booking.ts` passou a validar
 * que o horário do fluxo público está mesmo entre os horários livres.
 */
export function futureSlotTime(hoursFromNow: number) {
  const d = new Date(Date.now() + hoursFromNow * 60 * 60_000);
  d.setUTCMinutes(Math.ceil(d.getUTCMinutes() / 20) * 20, 0, 0);
  return d;
}
