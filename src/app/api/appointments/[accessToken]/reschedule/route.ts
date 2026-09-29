import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { cancelPendingWhatsAppJobs } from "@/lib/whatsappJobs";

/**
 * POST /api/appointments/:accessToken/reschedule
 *
 * Reagendamento via link único — mesma autenticação por token do cancelar e
 * confirmar presença (spec 8.7). Mantém profissional e serviço, só troca o
 * horário; o link/token continua o mesmo (não gera um novo agendamento).
 *
 * Mesma proteção de conflito de horário da criação (transação SERIALIZABLE,
 * ver /api/salons/:salonSlug/appointments) — dois clientes não podem cair no
 * mesmo horário do mesmo profissional.
 */

interface RescheduleBody {
  startAt: string; // ISO string
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ accessToken: string }> }
) {
  const { accessToken } = await params;
  const body = (await req.json()) as RescheduleBody;

  const newStartAt = new Date(body.startAt);
  if (Number.isNaN(newStartAt.getTime())) {
    return NextResponse.json({ error: "Horário inválido" }, { status: 400 });
  }
  if (newStartAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Não é possível reagendar para um horário no passado" }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(
      async (tx) => {
        const appointment = await tx.appointment.findUnique({
          where: { accessToken },
          include: { service: true, salon: { include: { presenceConfirmationCfg: true } } },
        });
        if (!appointment) {
          throw new Error("NOT_FOUND");
        }
        if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED") {
          throw new Error("CANNOT_RESCHEDULE");
        }

        const newEndAt = new Date(newStartAt.getTime() + appointment.service.durationMinutes * 60_000);

        const conflict = await tx.appointment.findFirst({
          where: {
            id: { not: appointment.id },
            professionalId: appointment.professionalId,
            status: { not: "CANCELLED" },
            startAt: { lt: newEndAt },
            endAt: { gt: newStartAt },
          },
        });
        if (conflict) {
          throw new Error("SLOT_TAKEN");
        }

        const presenceEnabled = appointment.salon.presenceConfirmationCfg?.enabled ?? false;

        const result = await tx.appointment.update({
          where: { id: appointment.id },
          data: {
            startAt: newStartAt,
            endAt: newEndAt,
            // Novo horário exige nova confirmação de presença, se habilitada.
            status: presenceEnabled ? "AWAITING_CONFIRMATION" : "CONFIRMED",
            noShowHandledAt: null,
            rescheduledCount: { increment: 1 },
          },
        });

        // Os jobs antigos (REMINDER / PRESENCE_CHECK) apontam pro horário
        // errado — cancela os PENDING e recria em cima do novo horário.
        await cancelPendingWhatsAppJobs(appointment.id, tx);

        await tx.whatsAppMessageJob.create({
          data: {
            appointmentId: appointment.id,
            type: "REMINDER",
            scheduledFor: new Date(newStartAt.getTime() - 2 * 60 * 60_000),
          },
        });

        if (presenceEnabled) {
          const hoursBefore = appointment.salon.presenceConfirmationCfg?.hoursBefore ?? 24;
          await tx.whatsAppMessageJob.create({
            data: {
              appointmentId: appointment.id,
              type: "PRESENCE_CHECK",
              scheduledFor: new Date(newStartAt.getTime() - hoursBefore * 60 * 60_000),
            },
          });
        }

        return result;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      startAt: updated.startAt.toISOString(),
      endAt: updated.endAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    }
    if (err instanceof Error && err.message === "CANNOT_RESCHEDULE") {
      return NextResponse.json(
        { error: "Esse agendamento não pode mais ser reagendado" },
        { status: 409 }
      );
    }
    if (err instanceof Error && err.message === "SLOT_TAKEN") {
      return NextResponse.json(
        { error: "Esse horário acabou de ser ocupado. Escolha outro." },
        { status: 409 }
      );
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
      return NextResponse.json(
        { error: "Esse horário acabou de ser ocupado. Escolha outro." },
        { status: 409 }
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Erro ao reagendar" }, { status: 500 });
  }
}
