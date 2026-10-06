import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cancelPendingWhatsAppJobs } from "@/lib/whatsappJobs";
import { recordAppointmentEvent } from "@/lib/appointmentEvents";
import { absoluteUrl } from "@/lib/appUrl";
import { notifyStaffAboutAppointment, sendDailyAgendaDigests } from "@/lib/staffNotifications";

/**
 * GET /api/cron/whatsapp-jobs
 *
 * "Fila" de WhatsApp — ver arquitetura-modelo-de-dados.md, seção 4.
 * Chamado por um cron externo (Vercel Cron ou similar) a cada poucos
 * minutos. Busca jobs PENDING vencidos e envia, e também roda a checagem
 * de no-show (ver `handleNoShows` abaixo).
 *
 * Protegido por segredo: exige `Authorization: Bearer <CRON_SECRET>` quando
 * a env var `CRON_SECRET` está configurada. Vercel Cron manda esse header
 * automaticamente quando `CRON_SECRET` está setada no projeto.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  const messageResult = await processWhatsAppJobs();
  const noShowResult = await handleNoShows();
  // Depois do no-show: horário liberado já não entra no resumo do dia.
  const digestResult = await sendDailyAgendaDigests();

  return NextResponse.json({ ...messageResult, ...noShowResult, ...digestResult });
}

async function processWhatsAppJobs() {
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

  return { processed: pendingJobs.length, failed };
}

/**
 * Segunda metade da confirmação de presença (spec P0.10): quando o prazo
 * configurado (`hoursBefore` antes do horário) passa sem o cliente confirmar
 * presença, age de acordo com `PresenceConfirmationConfig.actionOnNoConfirm`:
 *  - RELEASE_SLOT: cancela o agendamento de verdade, liberando o horário, e
 *    cancela os jobs de WhatsApp PENDING que ainda restavam.
 *  - ALERT_ONLY: não mexe no status (o dono ainda pode confirmar manualmente
 *    com o cliente) — só marca `noShowHandledAt` pra a Agenda exibir o alerta
 *    pro dono. Sem WhatsApp real ainda, o "alerta" é essa sinalização visual.
 *
 * `noShowHandledAt` evita reprocessar o mesmo agendamento a cada execução.
 */
async function handleNoShows() {
  const now = new Date();

  const candidates = await prisma.appointment.findMany({
    where: {
      status: "AWAITING_CONFIRMATION",
      noShowHandledAt: null,
      salon: { presenceConfirmationCfg: { enabled: true } },
    },
    include: { salon: { include: { presenceConfirmationCfg: true } } },
  });

  const overdue = candidates.filter((appt) => {
    const hoursBefore = appt.salon.presenceConfirmationCfg?.hoursBefore ?? 24;
    const deadline = new Date(appt.startAt.getTime() - hoursBefore * 60 * 60_000);
    return now >= deadline;
  });

  let released = 0;
  let alerted = 0;

  for (const appt of overdue) {
    const action = appt.salon.presenceConfirmationCfg?.actionOnNoConfirm ?? "ALERT_ONLY";

    if (action === "RELEASE_SLOT") {
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { status: "CANCELLED", noShowHandledAt: now },
      });
      await cancelPendingWhatsAppJobs(appt.id);
      await recordAppointmentEvent({
        salonId: appt.salonId,
        appointmentId: appt.id,
        type: "CANCELLED",
        actor: "SYSTEM",
        note: "Liberado automaticamente por falta de confirmação de presença",
      });
      await notifyStaffAboutAppointment({ appointmentId: appt.id, kind: "CANCELLED", actor: "SYSTEM" });
      released += 1;
    } else {
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { noShowHandledAt: now },
      });
      alerted += 1;
    }
  }

  return { noShowReleased: released, noShowAlerted: alerted };
}

async function sendWhatsAppMessage(
  job: Awaited<ReturnType<typeof prisma.whatsAppMessageJob.findMany>>[number] & {
    appointment: {
      accessToken: string;
      startAt: Date;
      client: { name: string; phone: string };
      salon: { slug: string };
    };
  }
) {
  // TODO: integrar de verdade com a Meta Cloud API (ou provedor equivalente).
  // Por enquanto, só a estrutura da mensagem por tipo — o envio real fica
  // pra quando a conta de WhatsApp Business estiver configurada.
  const manageLink = absoluteUrl(`/${job.appointment.salon.slug}/agendamento/${job.appointment.accessToken}`);

  const messages: Record<string, string> = {
    BOOKING_CONFIRMATION: `Seu agendamento foi confirmado! Gerencie aqui: ${manageLink}`,
    REMINDER: `Lembrete: seu horário é em breve. Detalhes: ${manageLink}`,
    PRESENCE_CHECK: `Confirme sua presença no horário marcado: ${manageLink}`,
  };

  console.log(`[whatsapp:${job.type}] para ${job.appointment.client.phone}: ${messages[job.type]}`);
  // await whatsappProvider.send({ to: job.appointment.client.phone, body: messages[job.type] })
}
