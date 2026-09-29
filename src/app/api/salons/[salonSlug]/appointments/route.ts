import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

/**
 * POST /api/salons/:salonSlug/appointments
 *
 * Cria um agendamento self-service do cliente (spec seção 8.4).
 * Implementa a Opção A da arquitetura-modelo-de-dados.md, seção 4:
 * transação SERIALIZABLE em vez de EXCLUDE constraint — suficiente pro
 * volume esperado do MVP, mais simples de manter. Se dois clientes
 * baterem no mesmo horário ao mesmo tempo, o Postgres derruba uma das
 * duas transações com erro de serialização (código P2034 no Prisma) —
 * tratamos isso como "horário acabou de ser ocupado".
 */

interface CreateAppointmentBody {
  professionalId: string;
  serviceId: string;
  clientName: string;
  clientPhone: string;
  startAt: string; // ISO string
  wantsToPayNow: boolean;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ salonSlug: string }> }
) {
  const { salonSlug } = await params;
  const body = (await req.json()) as CreateAppointmentBody;

  const salon = await prisma.salon.findUnique({
    where: { slug: salonSlug },
  });
  if (!salon) {
    return NextResponse.json({ error: "Salão não encontrado" }, { status: 404 });
  }

  const service = await prisma.service.findFirst({
    where: { id: body.serviceId, salonId: salon.id },
  });
  if (!service) {
    return NextResponse.json({ error: "Serviço inválido" }, { status: 400 });
  }

  const startAt = new Date(body.startAt);
  const endAt = new Date(startAt.getTime() + service.durationMinutes * 60_000);

  try {
    const appointment = await prisma.$transaction(
      async (tx) => {
        // Overlap: qualquer agendamento do mesmo profissional, não cancelado,
        // cujo intervalo cruze [startAt, endAt).
        const conflict = await tx.appointment.findFirst({
          where: {
            professionalId: body.professionalId,
            status: { not: "CANCELLED" },
            startAt: { lt: endAt },
            endAt: { gt: startAt },
          },
        });
        if (conflict) {
          throw new Error("SLOT_TAKEN");
        }

        // Cliente: mesmo telefone dentro do salão = mesmo cliente (spec seção 6).
        const client = await tx.client.upsert({
          where: { salonId_phone: { salonId: salon.id, phone: body.clientPhone } },
          update: { name: body.clientName },
          create: { salonId: salon.id, name: body.clientName, phone: body.clientPhone },
        });

        // Dispara os jobs de WhatsApp (spec seção 8.5/8.6) — a fila de verdade
        // é a tabela whatsapp_message_jobs, consumida pelo cron (ver
        // /api/cron/whatsapp-jobs). Aqui só agendamos os horários de envio.
        const presenceCfg = await tx.presenceConfirmationConfig.findUnique({
          where: { salonId: salon.id },
        });

        const created = await tx.appointment.create({
          data: {
            salonId: salon.id,
            professionalId: body.professionalId,
            serviceId: service.id,
            clientId: client.id,
            startAt,
            endAt,
            // Se a confirmação de presença está habilitada, o agendamento só
            // vira CONFIRMED quando o cliente confirmar via link (spec 8.6);
            // caso contrário, já nasce confirmado.
            status: presenceCfg?.enabled ? "AWAITING_CONFIRMATION" : "CONFIRMED",
            paidSelfReported: body.wantsToPayNow,
          },
        });

        await tx.whatsAppMessageJob.create({
          data: {
            appointmentId: created.id,
            type: "BOOKING_CONFIRMATION",
            scheduledFor: new Date(), // envio imediato
          },
        });

        await tx.whatsAppMessageJob.create({
          data: {
            appointmentId: created.id,
            type: "REMINDER",
            scheduledFor: new Date(startAt.getTime() - 2 * 60 * 60_000), // 2h antes — ajustar se virar config
          },
        });

        if (presenceCfg?.enabled) {
          await tx.whatsAppMessageJob.create({
            data: {
              appointmentId: created.id,
              type: "PRESENCE_CHECK",
              scheduledFor: new Date(
                startAt.getTime() - presenceCfg.hoursBefore * 60 * 60_000
              ),
            },
          });
        }

        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return NextResponse.json(
      {
        id: appointment.id,
        accessToken: appointment.accessToken,
        manageUrl: `/${salonSlug}/agendamento/${appointment.accessToken}`,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof Error && err.message === "SLOT_TAKEN") {
      return NextResponse.json(
        { error: "Esse horário acabou de ser ocupado. Escolha outro." },
        { status: 409 }
      );
    }
    // P2034 = falha de serialização do Postgres — dois clientes bateram no
    // mesmo horário ao mesmo tempo. Tratamos como o mesmo caso acima.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "Esse horário acabou de ser ocupado. Escolha outro." },
        { status: 409 }
      );
    }
    console.error(err);
    return NextResponse.json({ error: "Erro ao criar agendamento" }, { status: 500 });
  }
}
