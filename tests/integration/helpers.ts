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
      "appointments",
      "service_professionals",
      "availability_exceptions",
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

  await prisma.presenceConfirmationConfig.create({
    data: {
      salonId: salon.id,
      enabled: overrides.presenceConfirmationEnabled ?? true,
      hoursBefore: 24,
    },
  });

  return { owner, salon, professional, service };
}
