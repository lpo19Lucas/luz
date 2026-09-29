import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/cron/whatsapp-jobs
 *
 * "Fila" de WhatsApp — ver arquitetura-modelo-de-dados.md, seção 4.
 * Chamado por um cron externo (Vercel Cron ou similar) a cada poucos
 * minutos. Busca jobs PENDING vencidos e envia.
 *
 * Proteger com um segredo (header ou query param) antes de expor em
 * produção — Vercel Cron manda um header `Authorization: Bearer <secret>`
 * configurável; validar isso aqui é TODO antes do deploy real.
 *
 * TODO (não implementado neste scaffold): a segunda metade da confirmação
 * de presença — quando um job PRESENCE_CHECK foi enviado e o prazo do
 * agendamento chegou sem o cliente confirmar, alguém precisa checar
 * PresenceConfirmationConfig.actionOnNoConfirm e agir (alertar o dono, ou
 * liberar o horário). Esse é outro job/rotina, ainda não escrito aqui.
 */
export async function GET() {
  const pendingJobs = await prisma.whatsAppMessageJob.findMany({
    where: { status: "PENDING", scheduledFor: { lte: new Date() } },
    include: {
      appointment: {
        include: { client: true, professional: true, service: true, salon: true },
      },
    },
    take: 50, // processa em lotes pra não segurar a função serverless demais
  });

  const results = await Promise.allSettled(
    pendingJobs.map(async (job) => {
      await sendWhatsAppMessage(job);
      await prisma.whatsAppMessageJob.update({
        where: { id: job.id },
        data: { status: "SENT", sentAt: new Date() },
      });
    })
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    // Marca como FAILED os que rejeitaram — não impede o restante de seguir.
    await Promise.all(
      results.map((r, i) =>
        r.status === "rejected"
          ? prisma.whatsAppMessageJob.update({
              where: { id: pendingJobs[i].id },
              data: { status: "FAILED", failReason: String(r.reason) },
            })
          : Promise.resolve()
      )
    );
  }

  return NextResponse.json({ processed: pendingJobs.length, failed });
}

async function sendWhatsAppMessage(
  job: Awaited<ReturnType<typeof prisma.whatsAppMessageJob.findMany>>[number] & {
    appointment: { accessToken: string; startAt: Date; client: { name: string; phone: string } };
  }
) {
  // TODO: integrar de verdade com a Meta Cloud API (ou provedor equivalente).
  // Por enquanto, só a estrutura da mensagem por tipo — o envio real fica
  // pra quando a conta de WhatsApp Business estiver configurada.
  const manageLink = `https://SEU_DOMINIO/agendamento/${job.appointment.accessToken}`;

  const messages: Record<string, string> = {
    BOOKING_CONFIRMATION: `Seu agendamento foi confirmado! Gerencie aqui: ${manageLink}`,
    REMINDER: `Lembrete: seu horário é em breve. Detalhes: ${manageLink}`,
    PRESENCE_CHECK: `Confirme sua presença no horário marcado: ${manageLink}`,
  };

  console.log(`[whatsapp:${job.type}] para ${job.appointment.client.phone}: ${messages[job.type]}`);
  // await whatsappProvider.send({ to: job.appointment.client.phone, body: messages[job.type] })
}
