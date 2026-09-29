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

async function createAppointment() {
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
    },
  });
}

function cancel(accessToken: string) {
  const req = new NextRequest("http://localhost/api/appointments/x/cancel", { method: "POST" });
  return POST(req, { params: Promise.resolve({ accessToken }) });
}

describe("POST /api/appointments/[accessToken]/cancel", () => {
  it("cancela um agendamento válido", async () => {
    const appointment = await createAppointment();

    const res = await cancel(appointment.accessToken);
    expect(res.status).toBe(200);

    const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(updated.status).toBe("CANCELLED");
  });

  it("retorna 404 para um token que não existe", async () => {
    const res = await cancel("token-que-nao-existe");
    expect(res.status).toBe(404);
  });

  it("retorna 409 ao tentar cancelar duas vezes (idempotência)", async () => {
    const appointment = await createAppointment();

    await cancel(appointment.accessToken);
    const second = await cancel(appointment.accessToken);

    expect(second.status).toBe(409);
  });
});
