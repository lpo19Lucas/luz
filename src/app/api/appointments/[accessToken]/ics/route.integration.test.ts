/**
 * Teste de integração — Postgres real (`postgres_test`).
 *
 * "Adicionar à agenda" do cliente: a criação do agendamento e a tela de
 * gerenciar devolvem os links (Google + .ics), e a rota .ics serve o arquivo
 * do agendamento certo (com SEQUENCE subindo a cada remarcação).
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon, futureSlotTime } from "@tests/integration/helpers";
import { GET as getIcs } from "./route";
import { GET as getDetails } from "../route";
import { POST as createBooking } from "@/app/api/salons/[salonSlug]/appointments/route";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function book() {
  const t = await createTestSalon();
  const req = new NextRequest(`http://localhost/api/salons/${t.salon.slug}/appointments`, {
    method: "POST",
    body: JSON.stringify({
      professionalId: t.professional.id,
      serviceId: t.service.id,
      clientName: "Ana",
      clientPhone: "11999990000",
      startAt: futureSlotTime(48).toISOString(),
      wantsToPayNow: false,
    }),
  });
  const res = await createBooking(req, { params: Promise.resolve({ salonSlug: t.salon.slug }) });
  return { t, res, body: await res.json() };
}

function ctx(accessToken: string) {
  return { params: Promise.resolve({ accessToken }) };
}

describe("links de agenda do cliente", () => {
  it("a criação do agendamento já devolve Google + .ics", async () => {
    const { res, body } = await book();
    expect(res.status).toBe(201);
    expect(body.calendar.icsUrl).toBe(`/api/appointments/${body.accessToken}/ics`);
    expect(body.calendar.googleUrl).toContain("calendar.google.com");
    expect(decodeURIComponent(body.calendar.googleUrl)).toContain("Corte");
  });

  it("a tela de gerenciar devolve os links e some depois do cancelamento", async () => {
    const { body } = await book();
    const details = await (await getDetails(new NextRequest("http://localhost"), ctx(body.accessToken))).json();
    expect(details.calendar.icsUrl).toBe(`/api/appointments/${body.accessToken}/ics`);

    await prisma.appointment.update({ where: { accessToken: body.accessToken }, data: { status: "CANCELLED" } });
    const after = await (await getDetails(new NextRequest("http://localhost"), ctx(body.accessToken))).json();
    expect(after.calendar).toBeNull();
  });

  it("GET .ics serve o arquivo do agendamento como anexo", async () => {
    const { body } = await book();
    const res = await getIcs(new NextRequest("http://localhost"), ctx(body.accessToken));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(res.headers.get("content-disposition")).toContain("agendamento.ics");
    const ics = await res.text();
    expect(ics).toContain(`UID:${body.id}@luz-agendamento`);
    expect(ics).toContain("SEQUENCE:0");
    expect(ics).toContain("SUMMARY:Corte — Salão Teste");
  });

  it("depois de remarcar, SEQUENCE sobe; cancelado sai como CANCELLED", async () => {
    const { body } = await book();
    await prisma.appointment.update({ where: { accessToken: body.accessToken }, data: { rescheduledCount: 1 } });
    expect(await (await getIcs(new NextRequest("http://localhost"), ctx(body.accessToken))).text()).toContain("SEQUENCE:1");

    await prisma.appointment.update({ where: { accessToken: body.accessToken }, data: { status: "CANCELLED" } });
    expect(await (await getIcs(new NextRequest("http://localhost"), ctx(body.accessToken))).text()).toContain("STATUS:CANCELLED");
  });

  it("token inexistente → 404", async () => {
    const res = await getIcs(new NextRequest("http://localhost"), ctx("nao-existe"));
    expect(res.status).toBe(404);
  });
});
