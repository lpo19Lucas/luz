/**
 * Teste de integração — Postgres real (`postgres_test`), web-push simulado.
 *
 * Fase E4 — avisos pro cliente com o cron diário das 7h: lembrete do dia,
 * confirmação de presença na véspera (só se o salão pede e ainda não
 * confirmou), pedido de avaliação no dia seguinte, confirmação imediata ao
 * ativar, e nada pra salão bloqueado, cliente banido ou cron repetido.
 */
import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon, futureSlotTime } from "@tests/integration/helpers";
import { saveSubscription } from "@/lib/push";
import { createAppointment } from "@/lib/booking";
import {
  sendClientDailyNotifications,
  sendBookingConfirmedToClient,
  reminderTodayMessage,
  presenceCheckMessage,
} from "@/lib/clientNotifications";

jest.mock("web-push", () => ({ __esModule: true, default: { setVapidDetails: jest.fn(), sendNotification: jest.fn() } }));
const send = webpush.sendNotification as jest.Mock;

const DAY = 24 * 60 * 60_000;
let n = 0;

/** Instante no dia de Brasília `offsetDays` a partir de hoje, na hora indicada. */
function brt(offsetDays: number, hour: number) {
  const brtToday = new Date(Date.now() - 3 * 60 * 60_000).toISOString().slice(0, 10);
  return new Date(new Date(`${brtToday}T00:00:00Z`).getTime() + offsetDays * DAY + (hour + 3) * 60 * 60_000);
}
const SEVEN_AM = () => brt(0, 7);

async function apptWithDevice(
  overrides: { startAt: Date; status?: "CONFIRMED" | "AWAITING_CONFIRMATION" | "COMPLETED" },
  salonOverrides: Parameters<typeof createTestSalon>[0] = {}
) {
  const t = await createTestSalon(salonOverrides);
  const { appointment } = await createAppointment({
    salonSlug: t.salon.slug,
    professionalId: t.professional.id,
    serviceId: t.service.id,
    clientName: "Ana Souza",
    clientPhone: "11999990000",
    startAt: futureSlotTime(72),
    wantsToPayNow: false,
    source: "OWNER",
    actor: "OWNER",
  });
  const appt = await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      startAt: overrides.startAt,
      endAt: new Date(overrides.startAt.getTime() + 30 * 60_000),
      status: overrides.status ?? "CONFIRMED",
    },
  });
  n++;
  await saveSubscription({ endpoint: `https://push.example.com/c${n}`, keys: { p256dh: "p", auth: "a" } }, { salonId: t.salon.id, clientId: appt.clientId });
  return { t, appt };
}

beforeAll(() => {
  process.env.VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
});

beforeEach(async () => {
  await resetDb();
  send.mockReset();
  send.mockResolvedValue({ statusCode: 201 });
});

afterAll(async () => {
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  await prisma.$disconnect();
});

const titles = () => send.mock.calls.map((c) => JSON.parse(c[1]).title as string);

describe("cron das 7h — cliente", () => {
  it("lembra quem tem horário hoje", async () => {
    await apptWithDevice({ startAt: brt(0, 15) });
    expect(await sendClientDailyNotifications(SEVEN_AM())).toMatchObject({ clientReminders: 1 });
    expect(titles()[0]).toMatch(/^Hoje às 15:00/);
  });

  it("pede confirmação de presença na véspera só de quem ainda não confirmou", async () => {
    await apptWithDevice({ startAt: brt(1, 10), status: "AWAITING_CONFIRMATION" });
    await apptWithDevice({ startAt: brt(1, 11), status: "CONFIRMED" });
    expect(await sendClientDailyNotifications(SEVEN_AM())).toMatchObject({ clientPresenceChecks: 1, clientReminders: 0 });
    expect(titles()[0]).toMatch(/^Confirme sua presença/);
  });

  it("salão sem confirmação de presença não pede", async () => {
    await apptWithDevice({ startAt: brt(1, 10), status: "AWAITING_CONFIRMATION" }, { presenceConfirmationEnabled: false });
    expect(await sendClientDailyNotifications(SEVEN_AM())).toMatchObject({ clientPresenceChecks: 0 });
  });

  it("pede avaliação de atendimento concluído ontem e sem avaliação", async () => {
    const { t, appt } = await apptWithDevice({ startAt: brt(-1, 14), status: "COMPLETED" });
    expect(await sendClientDailyNotifications(SEVEN_AM())).toMatchObject({ clientReviewRequests: 1 });
    await prisma.review.create({ data: { salonId: t.salon.id, appointmentId: appt.id, clientId: appt.clientId, rating: 5 } });
    await prisma.notificationLog.deleteMany();
    send.mockClear();
    expect(await sendClientDailyNotifications(SEVEN_AM())).toMatchObject({ clientReviewRequests: 0 });
  });

  it("não repete se o cron rodar duas vezes", async () => {
    await apptWithDevice({ startAt: brt(0, 15) });
    await sendClientDailyNotifications(SEVEN_AM());
    await sendClientDailyNotifications(SEVEN_AM());
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("remarcado pra hoje de novo recebe outro lembrete (horário novo = chave nova)", async () => {
    const { appt } = await apptWithDevice({ startAt: brt(0, 15) });
    await sendClientDailyNotifications(SEVEN_AM());
    await prisma.appointment.update({ where: { id: appt.id }, data: { startAt: brt(0, 17) } });
    await sendClientDailyNotifications(SEVEN_AM());
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("salão bloqueado e cliente banido ficam de fora", async () => {
    await apptWithDevice({ startAt: brt(0, 15) }, { subscriptionAccess: "BLOCKED" });
    const { appt } = await apptWithDevice({ startAt: brt(0, 16) });
    await prisma.client.update({ where: { id: appt.clientId }, data: { bannedAt: new Date() } });
    expect(await sendClientDailyNotifications(SEVEN_AM())).toMatchObject({ clientReminders: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it("cancelado não recebe nada", async () => {
    const { appt } = await apptWithDevice({ startAt: brt(0, 15) });
    await prisma.appointment.update({ where: { id: appt.id }, data: { status: "CANCELLED" } });
    await sendClientDailyNotifications(SEVEN_AM());
    expect(send).not.toHaveBeenCalled();
  });
});

describe("confirmação ao ativar", () => {
  it("manda uma vez por horário, com link pra tela de gerenciar", async () => {
    const { t, appt } = await apptWithDevice({ startAt: new Date(Date.now() + 2 * DAY) });
    expect((await sendBookingConfirmedToClient(appt.accessToken))?.status).toBe("SENT");
    expect((await sendBookingConfirmedToClient(appt.accessToken))?.status).toBe("DUPLICATE");
    const payload = JSON.parse(send.mock.calls[0][1]);
    expect(payload.url).toBe(`/${t.salon.slug}/agendamento/${appt.accessToken}`);
    expect(payload.icon).toContain(`salon=${t.salon.slug}`);
  });

  it("não manda pra horário que já passou", async () => {
    const { appt } = await apptWithDevice({ startAt: new Date(Date.now() - DAY) });
    expect(await sendBookingConfirmedToClient(appt.accessToken)).toBeNull();
  });
});

describe("textos", () => {
  const appt = {
    startAt: new Date("2026-10-10T13:00:00Z"),
    service: { name: "Corte" },
    professional: { name: "João" },
    salon: { name: "Studio Ana", slug: "studio-ana" },
    client: { name: "Bia Lima" },
    accessToken: "tok",
  };
  it("usa o primeiro nome, horário de Brasília e nunca telefone", () => {
    const today = reminderTodayMessage(appt);
    expect(today.title).toBe("Hoje às 10:00 · Studio Ana");
    expect(today.body).toMatch(/^Bia, seu Corte com João é hoje/);
    expect(presenceCheckMessage(appt).body).toContain("amanhã às 10:00");
  });
});
