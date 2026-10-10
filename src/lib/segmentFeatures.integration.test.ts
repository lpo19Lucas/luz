/**
 * Teste de integração — recursos por segmento: ficha + preço por porte
 * (pet shop / lava-jato) e modo discreto (saúde / podologia).
 */
import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon, futureSlotTime } from "@tests/integration/helpers";
import { createAppointment, BookingError } from "@/lib/booking";
import { getClientStats } from "@/lib/clientStats";
import { submitReviewByToken, getPublicReviews, ReviewError } from "@/lib/reviews";
import { bookingConfirmedMessage, reminderTodayMessage, presenceCheckMessage } from "@/lib/clientNotifications";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function setup(segment: string, sizePrices?: Record<string, number>) {
  const t = await createTestSalon({ presenceConfirmationEnabled: false });
  await prisma.salon.update({ where: { id: t.salon.id }, data: { segment } });
  if (sizePrices) await prisma.service.update({ where: { id: t.service.id }, data: { sizePricesJson: sizePrices } });
  return t;
}

function book(t: Awaited<ReturnType<typeof setup>>, extra: Record<string, unknown> = {}) {
  return createAppointment({
    salonSlug: t.salon.slug,
    professionalId: t.professional.id,
    serviceId: t.service.id,
    clientName: "Tutora",
    clientPhone: "11999990000",
    startAt: futureSlotTime(24),
    wantsToPayNow: false,
    source: "ONLINE",
    actor: "CLIENT",
    ...extra,
  });
}

describe("ficha e preço por porte", () => {
  it("pet shop exige a ficha no fluxo público", async () => {
    const t = await setup("pet-shop");
    await expect(book(t)).rejects.toThrow(new BookingError("ASSET_REQUIRED"));
    await expect(book(t, { asset: { name: "Thor", size: "ENORME" } })).rejects.toThrow(new BookingError("ASSET_REQUIRED"));
  });

  it("grava a ficha e o preço do porte no atendimento", async () => {
    const t = await setup("pet-shop", { SMALL: 4000, LARGE: 9000 });
    const { appointment } = await book(t, { asset: { name: "Thor", size: "LARGE", detail: "Golden" } });

    const saved = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id }, include: { asset: true } });
    expect(saved.priceCents).toBe(9000);
    expect(saved.asset).toMatchObject({ kind: "PET", name: "Thor", size: "LARGE", detail: "Golden" });
  });

  it("porte sem preço próprio usa o preço do serviço, e a ficha do mesmo pet é reaproveitada", async () => {
    const t = await setup("pet-shop", { LARGE: 9000 });
    const first = await book(t, { asset: { name: "Thor", size: "MEDIUM", detail: "Golden" } });
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: first.appointment.id } })).priceCents).toBe(5000);

    await prisma.appointment.update({ where: { id: first.appointment.id }, data: { status: "CANCELLED" } });
    await book(t, { asset: { name: "thor", size: "LARGE", detail: "golden" } });
    const assets = await prisma.clientAsset.findMany();
    expect(assets).toHaveLength(1);
    expect(assets[0].size).toBe("LARGE"); // porte atualizado
  });

  it("lava-jato guarda veículo; o faturamento do cliente usa o preço do porte", async () => {
    const t = await setup("lava-jato", { LARGE: 12000 });
    const { appointment } = await book(t, { asset: { name: "Hilux", size: "LARGE", detail: "ABC1D23" } });
    expect((await prisma.clientAsset.findFirstOrThrow()).kind).toBe("VEHICLE");

    await prisma.appointment.update({ where: { id: appointment.id }, data: { status: "COMPLETED" } });
    const stats = await getClientStats(t.salon.id, appointment.clientId);
    expect(stats.totalSpentCents).toBe(12000);
  });

  it("dono pode agendar sem ficha (preço do serviço); segmento sem ficha ignora o que vier", async () => {
    const pet = await setup("pet-shop");
    const manual = await book(pet, { source: "OWNER", actor: "OWNER" });
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: manual.appointment.id } })).priceCents).toBeNull();

    await resetDb();
    const barber = await setup("barbearia");
    const { appointment } = await book(barber, { asset: { name: "Thor", size: "LARGE" } });
    const saved = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(saved.assetId).toBeNull();
    expect(await prisma.clientAsset.count()).toBe(0);
  });
});

describe("modo discreto", () => {
  async function completedAppointment(segment: string) {
    const t = await setup(segment);
    const { appointment } = await book(t);
    await prisma.appointment.update({ where: { id: appointment.id }, data: { status: "COMPLETED" } });
    return { t, appointment };
  }

  it("não aceita avaliação pública e a vitrine não mostra nenhuma", async () => {
    const { t, appointment } = await completedAppointment("psicologo");
    await expect(submitReviewByToken({ accessToken: appointment.accessToken, rating: 5 })).rejects.toThrow(
      new ReviewError("NOT_ALLOWED")
    );

    // Mesmo que exista uma avaliação antiga, a vitrine do negócio discreto fica vazia.
    await prisma.review.create({
      data: { salonId: t.salon.id, appointmentId: appointment.id, clientId: appointment.clientId, rating: 5 },
    });
    expect((await getPublicReviews(t.salon.id)).total).toBe(0);
  });

  it("segmento comum continua avaliando normalmente", async () => {
    const { t, appointment } = await completedAppointment("barbearia");
    await submitReviewByToken({ accessToken: appointment.accessToken, rating: 5 });
    expect((await getPublicReviews(t.salon.id)).total).toBe(1);
  });

  it("os avisos ao cliente não citam serviço nem profissional", async () => {
    const t = await setup("dentista");
    const { appointment } = await book(t);
    const full = await prisma.appointment.findUniqueOrThrow({
      where: { id: appointment.id },
      include: { service: true, professional: true, client: true, salon: true },
    });
    for (const make of [bookingConfirmedMessage, reminderTodayMessage, presenceCheckMessage]) {
      const msg = make(full);
      expect(msg.title + msg.body).not.toMatch(/Corte|Profissional Teste/);
      expect(msg.body).toContain("horário");
    }
  });
});
