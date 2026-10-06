/**
 * Teste de integração — Postgres real (`postgres_test`), web-push simulado.
 *
 * Fase E3 — avisos pra equipe: quem recebe cada evento (dono, profissional,
 * nunca quem fez a ação), preferências de silenciar, pacote/avaliação só pro
 * dono, e o resumo das 7h (por pessoa, sem dia vazio, sem salão bloqueado,
 * sem repetir).
 */
import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon, futureSlotTime } from "@tests/integration/helpers";
import { saveSubscription } from "@/lib/push";
import { grantProfessionalAccess } from "@/lib/professionalAccess";
import { createAppointment } from "@/lib/booking";
import {
  notifyStaffAboutAppointment,
  notifyOwnerAboutPackageReservation,
  notifyOwnerAboutReview,
  sendDailyAgendaDigests,
  appointmentEventMessage,
  dailyAgendaMessage,
} from "@/lib/staffNotifications";

jest.mock("web-push", () => ({ __esModule: true, default: { setVapidDetails: jest.fn(), sendNotification: jest.fn() } }));
const send = webpush.sendNotification as jest.Mock;

let n = 0;
async function device(salonId: string, userId: string) {
  n++;
  await saveSubscription({ endpoint: `https://push.example.com/${n}`, keys: { p256dh: "p", auth: "a" } }, { salonId, userId });
}

/** Destinatários (por endpoint → userId) das notificações enviadas. */
async function recipients() {
  const endpoints = send.mock.calls.map((c) => c[0].endpoint as string);
  const subs = await prisma.pushSubscription.findMany({ where: { endpoint: { in: endpoints } } });
  return endpoints.map((e) => subs.find((s) => s.endpoint === e)?.userId);
}

async function setup() {
  const t = await createTestSalon();
  const { userId: proUserId } = await grantProfessionalAccess({ salonId: t.salon.id, professionalId: t.professional.id, email: "pro@x.com" });
  await device(t.salon.id, t.owner.id);
  await device(t.salon.id, proUserId);
  return { ...t, proUserId };
}

async function book(t: Awaited<ReturnType<typeof createTestSalon>>, hours = 48, actor: "CLIENT" | "OWNER" = "CLIENT") {
  const { appointment } = await createAppointment({
    salonSlug: t.salon.slug,
    professionalId: t.professional.id,
    serviceId: t.service.id,
    clientName: "Ana Souza",
    clientPhone: `1199999${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`,
    startAt: futureSlotTime(hours),
    wantsToPayNow: false,
    source: actor === "CLIENT" ? "ONLINE" : "OWNER",
    actor,
  });
  return appointment;
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

describe("quem recebe os eventos de agendamento", () => {
  it("agendamento do cliente: dono e profissional", async () => {
    const t = await setup();
    const appt = await book(t);
    expect(await notifyStaffAboutAppointment({ appointmentId: appt.id, kind: "CREATED", actor: "CLIENT" })).toBe(2);
    expect((await recipients()).sort()).toEqual([t.owner.id, t.proUserId].sort());
    const ownerPayload = JSON.parse(send.mock.calls.find((c) => c[0].endpoint === "https://push.example.com/" + (n - 1))?.[1] ?? "{}");
    expect(ownerPayload.title).toBe("Novo agendamento");
  });

  it("ação do dono avisa só o profissional; ação do profissional avisa só o dono", async () => {
    const t = await setup();
    const appt = await book(t, 48, "OWNER");
    await notifyStaffAboutAppointment({ appointmentId: appt.id, kind: "CANCELLED", actor: "OWNER" });
    expect(await recipients()).toEqual([t.proUserId]);
    send.mockClear();
    await notifyStaffAboutAppointment({ appointmentId: appt.id, kind: "CANCELLED", actor: "PROFESSIONAL" });
    expect(await recipients()).toEqual([t.owner.id]);
  });

  it("profissional sem acesso ou inativo não recebe", async () => {
    const t = await setup();
    const appt = await book(t);
    await prisma.professional.update({ where: { id: t.professional.id }, data: { active: false } });
    await notifyStaffAboutAppointment({ appointmentId: appt.id, kind: "CREATED", actor: "CLIENT" });
    expect(await recipients()).toEqual([t.owner.id]);
  });

  it("respeita o tipo silenciado e a conta bloqueada", async () => {
    const t = await setup();
    const appt = await book(t);
    await prisma.user.update({ where: { id: t.owner.id }, data: { mutedNotifications: ["BOOKING_CREATED"] } });
    await prisma.user.update({ where: { id: t.proUserId }, data: { disabledAt: new Date() } });
    expect(await notifyStaffAboutAppointment({ appointmentId: appt.id, kind: "CREATED", actor: "CLIENT" })).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("cada envio fica registrado com o tipo certo", async () => {
    const t = await setup();
    const appt = await book(t);
    await notifyStaffAboutAppointment({ appointmentId: appt.id, kind: "RESCHEDULED", actor: "CLIENT", previousStartAt: new Date() });
    const logs = await prisma.notificationLog.findMany();
    expect(logs).toHaveLength(2);
    expect(logs.every((l) => l.type === "BOOKING_RESCHEDULED" && l.appointmentId === appt.id && l.status === "SENT")).toBe(true);
  });
});

describe("textos", () => {
  const base = {
    clientName: "Ana Souza",
    serviceName: "Corte",
    professionalName: "João",
    startAt: new Date("2026-10-10T13:00:00Z"),
  };

  it("dono vê o profissional; profissional não precisa", () => {
    const owner = appointmentEventMessage({ ...base, kind: "CREATED", actor: "CLIENT", forRole: "OWNER" });
    const pro = appointmentEventMessage({ ...base, kind: "CREATED", actor: "CLIENT", forRole: "PROFESSIONAL" });
    expect(owner.body).toContain("Ana · Corte com João");
    expect(owner.body).toContain("10:00");
    expect(pro.body).toMatch(/^Ana · Corte · /);
  });

  it("cancelamento diferencia cliente, salão e liberação automática", () => {
    expect(appointmentEventMessage({ ...base, kind: "CANCELLED", actor: "CLIENT", forRole: "OWNER" }).body).toMatch(/^Ana cancelou/);
    expect(appointmentEventMessage({ ...base, kind: "CANCELLED", actor: "OWNER", forRole: "PROFESSIONAL" }).body).toMatch(/^Cancelado pelo salão/);
    expect(appointmentEventMessage({ ...base, kind: "CANCELLED", actor: "SYSTEM", forRole: "OWNER" }).body).toMatch(/^Horário liberado/);
  });

  it("remarcação mostra de → para", () => {
    const msg = appointmentEventMessage({ ...base, kind: "RESCHEDULED", actor: "CLIENT", forRole: "OWNER", previousStartAt: new Date("2026-10-09T13:00:00Z") });
    expect(msg.body).toContain("→");
  });

  it("resumo do dia: vazio não gera aviso; conta e mostra o primeiro", () => {
    expect(dailyAgendaMessage([])).toBeNull();
    const msg = dailyAgendaMessage([
      { startAt: new Date("2026-10-10T12:00:00Z"), clientName: "Bia Lima", serviceName: "Escova" },
      { startAt: new Date("2026-10-10T14:00:00Z"), clientName: "Ana", serviceName: "Corte" },
    ]);
    expect(msg?.body).toBe("2 atendimentos · primeiro às 09:00 (Bia, Escova)");
  });
});

describe("pacote e avaliação", () => {
  it("só o dono é avisado", async () => {
    const t = await setup();
    const def = await prisma.packageDefinition.create({
      data: { salonId: t.salon.id, name: "10 cortes", type: "SERVICE_CREDITS", serviceId: t.service.id, credits: 10, priceCents: 40000, validityDays: 180 },
    });
    const client = await prisma.client.create({ data: { salonId: t.salon.id, name: "Ana", phone: "11988887777" } });
    const pkg = await prisma.clientPackage.create({ data: { salonId: t.salon.id, clientId: client.id, packageDefinitionId: def.id } });
    expect(await notifyOwnerAboutPackageReservation(pkg.id)).toBe(1);
    expect(await recipients()).toEqual([t.owner.id]);

    send.mockClear();
    const appt = await book(t, -3, "OWNER");
    await prisma.appointment.update({ where: { id: appt.id }, data: { status: "COMPLETED" } });
    const review = await prisma.review.create({ data: { salonId: t.salon.id, appointmentId: appt.id, clientId: appt.clientId, rating: 4, comment: "Ótimo" } });
    await notifyOwnerAboutReview(review.id);
    expect(await recipients()).toEqual([t.owner.id]);
    expect(JSON.parse(send.mock.calls[0][1]).title).toBe("Nova avaliação ★★★★☆");
  });
});

describe("resumo das 7h", () => {
  // 7h de Brasília = 10h UTC; os atendimentos "de hoje" ficam mais tarde no mesmo dia.
  function todayAt(hourBrt: number) {
    const now = new Date();
    const brtDay = new Date(now.getTime() - 3 * 60 * 60_000).toISOString().slice(0, 10);
    return new Date(`${brtDay}T${String(hourBrt + 3).padStart(2, "0")}:00:00Z`);
  }

  it("dono recebe o do salão, profissional o dele; não repete no mesmo dia", async () => {
    const t = await setup();
    const appt = await book(t, 48);
    await prisma.appointment.update({ where: { id: appt.id }, data: { startAt: todayAt(20), endAt: todayAt(21) } });
    const morning = todayAt(7);

    expect(await sendDailyAgendaDigests(morning)).toEqual({ dailyDigests: 2 });
    expect((await recipients()).sort()).toEqual([t.owner.id, t.proUserId].sort());
    send.mockClear();
    expect(await sendDailyAgendaDigests(morning)).toEqual({ dailyDigests: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it("salão bloqueado e dia sem atendimento ficam de fora", async () => {
    const blocked = await createTestSalon({ subscriptionAccess: "BLOCKED" });
    await device(blocked.salon.id, blocked.owner.id);
    const appt = await book(blocked, 48, "OWNER");
    await prisma.appointment.update({ where: { id: appt.id }, data: { startAt: todayAt(20), endAt: todayAt(21) } });
    const empty = await createTestSalon();
    await device(empty.salon.id, empty.owner.id);

    expect(await sendDailyAgendaDigests(todayAt(7))).toEqual({ dailyDigests: 0 });
    expect(send).not.toHaveBeenCalled();
  });
});
