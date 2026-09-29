// Script de seed pra validar o schema e as regras de negócio manualmente.
// Roda com Node puro (CommonJS) pra não precisar de ts-node/tsx só pra isso.
// Uso: docker compose exec app node prisma/seed.js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const SEED_PASSWORD = "senha123";

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

function at(daysFromNow, hour, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

async function main() {
  const slug = "barbearia-exemplo";

  // Idempotente: rodar de novo limpa o salão de exemplo anterior (cascade cuida do resto).
  const existing = await prisma.salon.findUnique({ where: { slug } });
  if (existing) {
    await prisma.salon.delete({ where: { id: existing.id } });
  }

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  const owner = await prisma.user.upsert({
    where: { email: "lucas@barbearia-exemplo.com" },
    update: { passwordHash },
    create: {
      email: "lucas@barbearia-exemplo.com",
      passwordHash,
      name: "Lucas (dono)",
      phone: "11900001111",
    },
  });

  const salon = await prisma.salon.create({
    data: {
      name: "Barbearia Exemplo",
      slug,
      ownerId: owner.id,
      pixKey: "11900001111",
    },
  });

  await prisma.subscription.create({
    data: {
      salonId: salon.id,
      plan: "TRIAL",
      status: "TRIAL",
      trialEndsAt: new Date(Date.now() + 50 * DAY),
    },
  });

  await prisma.presenceConfirmationConfig.create({
    data: { salonId: salon.id, enabled: true, hoursBefore: 24, actionOnNoConfirm: "ALERT_ONLY" },
  });

  const joao = await prisma.professional.create({
    data: { salonId: salon.id, name: "João Barbeiro" },
  });
  const pedro = await prisma.professional.create({
    data: { salonId: salon.id, name: "Pedro Barbeiro" },
  });

  for (const professionalId of [joao.id, pedro.id]) {
    for (let weekday = 1; weekday <= 5; weekday++) {
      await prisma.availability.create({
        data: { professionalId, weekday, startTime: "09:00", endTime: "19:00" },
      });
    }
    await prisma.availability.create({
      data: { professionalId, weekday: 6, startTime: "09:00", endTime: "14:00" },
    });
  }

  const corte = await prisma.service.create({
    data: { salonId: salon.id, name: "Corte", durationMinutes: 30, priceCents: 4000 },
  });
  const barba = await prisma.service.create({
    data: { salonId: salon.id, name: "Barba", durationMinutes: 20, priceCents: 3000 },
  });
  const corteEBarba = await prisma.service.create({
    data: { salonId: salon.id, name: "Corte + Barba", durationMinutes: 50, priceCents: 6500 },
  });

  for (const serviceId of [corte.id, barba.id, corteEBarba.id]) {
    for (const professionalId of [joao.id, pedro.id]) {
      await prisma.serviceProfessional.create({ data: { serviceId, professionalId } });
    }
  }

  const carlos = await prisma.client.create({
    data: { salonId: salon.id, name: "Carlos Silva", phone: "11911112222" },
  });
  const marcos = await prisma.client.create({
    data: { salonId: salon.id, name: "Marcos Souza", phone: "11922223333" },
  });
  const rafael = await prisma.client.create({
    data: { salonId: salon.id, name: "Rafael Lima", phone: "11933334444" },
  });

  // --- Agendamentos já concluídos (histórico, pra validar métricas/relatórios) ---
  await prisma.appointment.create({
    data: {
      salonId: salon.id,
      professionalId: joao.id,
      serviceId: corte.id,
      clientId: carlos.id,
      startAt: at(-3, 10, 0),
      endAt: at(-3, 10, 30),
      status: "COMPLETED",
      paidSelfReported: true,
      paidConfirmedByOwner: true,
    },
  });
  await prisma.appointment.create({
    data: {
      salonId: salon.id,
      professionalId: pedro.id,
      serviceId: barba.id,
      clientId: marcos.id,
      startAt: at(-5, 14, 0),
      endAt: at(-5, 14, 20),
      status: "COMPLETED",
      paidSelfReported: true,
      paidConfirmedByOwner: true,
    },
  });
  await prisma.appointment.create({
    data: {
      salonId: salon.id,
      professionalId: joao.id,
      serviceId: corteEBarba.id,
      clientId: rafael.id,
      startAt: at(-1, 11, 0),
      endAt: at(-1, 11, 50),
      status: "COMPLETED",
      paidSelfReported: true,
      paidConfirmedByOwner: false, // cliente disse que pagou, dono ainda não conferiu
    },
  });
  // No-show: cliente não apareceu e o horário não foi cancelado.
  await prisma.appointment.create({
    data: {
      salonId: salon.id,
      professionalId: pedro.id,
      serviceId: corte.id,
      clientId: rafael.id,
      startAt: at(-2, 16, 0),
      endAt: at(-2, 16, 30),
      status: "CONFIRMED",
      paidSelfReported: false,
      paidConfirmedByOwner: false,
    },
  });

  // --- Agendamentos futuros (pra validar agenda, confirmação de presença, cancelamento) ---
  const futuroConfirmado = await prisma.appointment.create({
    data: {
      salonId: salon.id,
      professionalId: joao.id,
      serviceId: corte.id,
      clientId: carlos.id,
      startAt: at(1, 10, 0),
      endAt: at(1, 10, 30),
      status: "CONFIRMED",
    },
  });
  const futuroAguardando = await prisma.appointment.create({
    data: {
      salonId: salon.id,
      professionalId: pedro.id,
      serviceId: barba.id,
      clientId: marcos.id,
      startAt: at(2, 15, 0),
      endAt: at(2, 15, 20),
      status: "AWAITING_CONFIRMATION",
    },
  });
  await prisma.appointment.create({
    data: {
      salonId: salon.id,
      professionalId: joao.id,
      serviceId: corteEBarba.id,
      clientId: rafael.id,
      startAt: at(3, 9, 0),
      endAt: at(3, 9, 50),
      status: "CANCELLED",
    },
  });

  // Jobs de WhatsApp pros futuros — confirmação já "enviada", lembrete e
  // (quando aplicável) pedido de confirmação de presença ainda pendentes.
  for (const appt of [futuroConfirmado, futuroAguardando]) {
    await prisma.whatsAppMessageJob.create({
      data: {
        appointmentId: appt.id,
        type: "BOOKING_CONFIRMATION",
        status: "SENT",
        scheduledFor: new Date(),
        sentAt: new Date(),
      },
    });
    await prisma.whatsAppMessageJob.create({
      data: {
        appointmentId: appt.id,
        type: "REMINDER",
        status: "PENDING",
        scheduledFor: new Date(appt.startAt.getTime() - 2 * HOUR),
      },
    });
    await prisma.whatsAppMessageJob.create({
      data: {
        appointmentId: appt.id,
        type: "PRESENCE_CHECK",
        status: "PENDING",
        scheduledFor: new Date(appt.startAt.getTime() - 24 * HOUR),
      },
    });
  }

  console.log("Seed concluído.");
  console.log(`Salão: ${salon.name} (slug: ${salon.slug})`);
  console.log(`Login do dono: http://localhost:3000/login — ${owner.email} / ${SEED_PASSWORD}`);
  console.log(`Link público: http://localhost:3000/${salon.slug}`);
  console.log(`Gerenciar agendamento confirmado: http://localhost:3000/${salon.slug}/agendamento/${futuroConfirmado.accessToken}`);
  console.log(`Gerenciar agendamento aguardando confirmação: http://localhost:3000/${salon.slug}/agendamento/${futuroAguardando.accessToken}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
