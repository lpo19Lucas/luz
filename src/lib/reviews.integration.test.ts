/**
 * Teste de integração — bate no Postgres real do serviço `postgres_test`
 * (docker-compose.yml). Rodar com `docker compose exec app npm run test:integration`.
 *
 * Cobre o fluxo de avaliação pós-atendimento: só em agendamento COMPLETED,
 * uma vez por agendamento, nota 1-5, e ocultar/reexibir na vitrine pública.
 */
import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon, futureSlotTime } from "@tests/integration/helpers";
import { submitReviewByToken, getPublicReviews, getAllReviewsForOwner, ReviewError } from "@/lib/reviews";
import { createAppointment } from "@/lib/booking";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createCompletedAppointment(salon: Awaited<ReturnType<typeof createTestSalon>>) {
  const { appointment } = await createAppointment({
    salonSlug: salon.salon.slug,
    professionalId: salon.professional.id,
    serviceId: salon.service.id,
    clientName: "Ana",
    clientPhone: "11999991111",
    startAt: futureSlotTime(-2),
    wantsToPayNow: false,
    source: "OWNER",
    actor: "OWNER",
  });
  return prisma.appointment.update({ where: { id: appointment.id }, data: { status: "COMPLETED" } });
}

describe("submitReviewByToken", () => {
  it("funciona em agendamento COMPLETED", async () => {
    const salon = await createTestSalon();
    const appointment = await createCompletedAppointment(salon);

    const review = await submitReviewByToken({
      accessToken: appointment.accessToken,
      rating: 5,
      comment: "Excelente!",
    });

    expect(review.rating).toBe(5);
    expect(review.comment).toBe("Excelente!");
  });

  it("falha em agendamento não concluído", async () => {
    const salon = await createTestSalon();
    const { appointment } = await createAppointment({
      salonSlug: salon.salon.slug,
      professionalId: salon.professional.id,
      serviceId: salon.service.id,
      clientName: "Ana",
      clientPhone: "11999991112",
      startAt: futureSlotTime(24),
      wantsToPayNow: false,
      source: "ONLINE",
      actor: "CLIENT",
    });

    await expect(
      submitReviewByToken({ accessToken: appointment.accessToken, rating: 5 })
    ).rejects.toMatchObject({ code: "NOT_COMPLETED" } satisfies Partial<ReviewError>);
  });

  it("falha ao avaliar duas vezes o mesmo agendamento", async () => {
    const salon = await createTestSalon();
    const appointment = await createCompletedAppointment(salon);
    await submitReviewByToken({ accessToken: appointment.accessToken, rating: 4 });

    await expect(
      submitReviewByToken({ accessToken: appointment.accessToken, rating: 3 })
    ).rejects.toMatchObject({ code: "ALREADY_REVIEWED" } satisfies Partial<ReviewError>);
  });

  it("rejeita rating fora de 1-5", async () => {
    const salon = await createTestSalon();
    const appointment = await createCompletedAppointment(salon);

    await expect(
      submitReviewByToken({ accessToken: appointment.accessToken, rating: 6 })
    ).rejects.toMatchObject({ code: "INVALID_RATING" } satisfies Partial<ReviewError>);
  });
});

describe("visibilidade pública", () => {
  it("ocultar remove da lista pública mas mantém no banco e na lista do dono", async () => {
    const salon = await createTestSalon();
    const appointment = await createCompletedAppointment(salon);
    const review = await submitReviewByToken({ accessToken: appointment.accessToken, rating: 5 });

    let publicReviews = await getPublicReviews(salon.salon.id);
    expect(publicReviews.total).toBe(1);

    await prisma.review.update({ where: { id: review.id }, data: { hiddenByOwner: true } });

    publicReviews = await getPublicReviews(salon.salon.id);
    expect(publicReviews.total).toBe(0);

    const ownerReviews = await getAllReviewsForOwner(salon.salon.id);
    expect(ownerReviews).toHaveLength(1);
    expect(ownerReviews[0].hiddenByOwner).toBe(true);
  });
});
