import { prisma } from "@/lib/prisma";
import { dispatchInBackground, notifyOwnerAboutReview } from "@/lib/staffNotifications";

export type ReviewErrorCode = "NOT_FOUND" | "NOT_COMPLETED" | "ALREADY_REVIEWED" | "INVALID_RATING";

/** Erro de negócio do fluxo de avaliação — mesmo formato de BookingError/PackageError. */
export class ReviewError extends Error {
  code: ReviewErrorCode;
  constructor(code: ReviewErrorCode) {
    super(code);
    this.name = "ReviewError";
    this.code = code;
  }
}

/** Cliente avalia pelo link que já tem (accessToken) — só depois do atendimento
 * concluído (COMPLETED), uma vez por agendamento. */
export async function submitReviewByToken(params: { accessToken: string; rating: number; comment?: string }) {
  if (!Number.isInteger(params.rating) || params.rating < 1 || params.rating > 5) {
    throw new ReviewError("INVALID_RATING");
  }

  const appointment = await prisma.appointment.findUnique({
    where: { accessToken: params.accessToken },
    include: { review: true },
  });
  if (!appointment) throw new ReviewError("NOT_FOUND");
  if (appointment.status !== "COMPLETED") throw new ReviewError("NOT_COMPLETED");
  if (appointment.review) throw new ReviewError("ALREADY_REVIEWED");

  const review = await prisma.review.create({
    data: {
      salonId: appointment.salonId,
      appointmentId: appointment.id,
      clientId: appointment.clientId,
      rating: params.rating,
      comment: params.comment?.trim() || null,
    },
  });
  dispatchInBackground(() => notifyOwnerAboutReview(review.id));
  return review;
}

export interface PublicReviewsResult {
  averageRating: number | null;
  total: number;
  reviews: Array<{ id: string; rating: number; comment: string | null; clientName: string; createdAt: Date }>;
}

/** Avaliações não ocultas, pra vitrine pública (social proof) e pro JSON-LD. */
export async function getPublicReviews(salonId: string, limit = 20): Promise<PublicReviewsResult> {
  const reviews = await prisma.review.findMany({
    where: { salonId, hiddenByOwner: false },
    include: { client: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const allRatings = await prisma.review.findMany({
    where: { salonId, hiddenByOwner: false },
    select: { rating: true },
  });
  const averageRating =
    allRatings.length > 0 ? allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length : null;

  return {
    averageRating,
    total: allRatings.length,
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      // Primeiro nome + inicial do sobrenome, pra não expor o cliente inteiro na vitrine pública.
      clientName: truncateClientName(r.client.name),
      createdAt: r.createdAt,
    })),
  };
}

function truncateClientName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] ?? name;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

/** Todas as avaliações (inclusive ocultas) — pra tela do dono em /avaliacoes. */
export async function getAllReviewsForOwner(salonId: string) {
  return prisma.review.findMany({
    where: { salonId },
    include: { client: true, appointment: { include: { service: true, professional: true } } },
    orderBy: { createdAt: "desc" },
  });
}
