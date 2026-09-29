import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon } from "@tests/integration/helpers";
import { POST } from "./route";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createAppointment(status: "AWAITING_CONFIRMATION" | "CONFIRMED" | "CANCELLED") {
  const { salon, professional, service } = await createTestSalon();
  const client = await prisma.client.create({
    data: { salonId: salon.id, name: "Cliente", phone: "11999990000" },
  });
  return prisma.appointment.create({
    data: {
      salonId: salon.id,
      professionalId: professional.id,
      serviceId: service.id,
      clientId: client.id,
      startAt: new Date(Date.now() + 24 * 60 * 60_000),
      endAt: new Date(Date.now() + 25 * 60 * 60_000),
      status,
    },
  });
}

function confirmPresence(accessToken: string) {
  const req = new NextRequest("http://localhost/api/appointments/x/confirm-presence", {
    method: "POST",
  });
  return POST(req, { params: Promise.resolve({ accessToken }) });
}

describe("POST /api/appointments/[accessToken]/confirm-presence", () => {
  it("confirma presença quando o agendamento está aguardando confirmação", async () => {
    const appointment = await createAppointment("AWAITING_CONFIRMATION");

    const res = await confirmPresence(appointment.accessToken);
    expect(res.status).toBe(200);

    const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(updated.status).toBe("CONFIRMED");
  });

  it("também aceita confirmar um agendamento que já está CONFIRMED (idempotente)", async () => {
    const appointment = await createAppointment("CONFIRMED");

    const res = await confirmPresence(appointment.accessToken);
    expect(res.status).toBe(200);
  });

  it("retorna 409 para um agendamento já cancelado", async () => {
    const appointment = await createAppointment("CANCELLED");

    const res = await confirmPresence(appointment.accessToken);
    expect(res.status).toBe(409);
  });

  it("retorna 404 para um token que não existe", async () => {
    const res = await confirmPresence("token-que-nao-existe");
    expect(res.status).toBe(404);
  });
});
