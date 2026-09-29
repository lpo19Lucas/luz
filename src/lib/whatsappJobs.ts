import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Cancela os jobs de WhatsApp ainda PENDING de um agendamento — usado quando
 * o agendamento é cancelado (pelo cliente ou pela rotina de no-show) ou
 * reagendado. Não faz sentido lembrar/pedir confirmação de um horário que
 * não vale mais.
 */
export async function cancelPendingWhatsAppJobs(appointmentId: string, db: Db = prisma) {
  await db.whatsAppMessageJob.updateMany({
    where: { appointmentId, status: "PENDING" },
    data: { status: "FAILED", failReason: "CANCELLED_BEFORE_SEND" },
  });
}
