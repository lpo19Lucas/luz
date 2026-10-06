/**
 * Teste de integração — Postgres real (`postgres_test`).
 *
 * Fase P — acesso do profissional: convite (conta nova ou existente), regras
 * de bloqueio (e-mail de dono, vínculo duplicado), reenvio, revogação, quem é
 * quem no login (resolveMember) e a agenda que o profissional enxerga.
 */
import { prisma } from "@/lib/prisma";
import { resetDb, createTestSalon, futureSlotTime } from "@tests/integration/helpers";
import {
  grantProfessionalAccess,
  resendProfessionalLink,
  revokeProfessionalAccess,
  getProfessionalAgenda,
} from "@/lib/professionalAccess";
import { resolveMember } from "@/lib/members";
import { findValidPasswordToken } from "@/lib/passwordReset";
import { setAppointmentOutcome } from "@/lib/appointmentOutcome";
import { createAppointment } from "@/lib/booking";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const nowSec = () => Math.floor(Date.now() / 1000);

async function book(t: Awaited<ReturnType<typeof createTestSalon>>, professionalId: string, hours: number, phone = "11999990000") {
  const { appointment } = await createAppointment({
    salonSlug: t.salon.slug,
    professionalId,
    serviceId: t.service.id,
    clientName: "Ana",
    clientPhone: phone,
    startAt: futureSlotTime(hours),
    wantsToPayNow: false,
    source: "OWNER",
    actor: "OWNER",
  });
  return appointment;
}

describe("grantProfessionalAccess", () => {
  it("cria a conta, vincula e devolve convite (INVITE) com WhatsApp", async () => {
    const t = await createTestSalon();
    const result = await grantProfessionalAccess({
      salonId: t.salon.id,
      professionalId: t.professional.id,
      email: " Joao@Salao.com ",
      phone: "(11) 97777-6666",
    });
    expect(result.whatsappHref).toMatch(/^https:\/\/wa\.me\/5511977776666/);
    const pro = await prisma.professional.findUniqueOrThrow({ where: { id: t.professional.id }, include: { user: true } });
    expect(pro.user?.email).toBe("joao@salao.com");
    expect(pro.phone).toBe("11977776666");
    const token = await findValidPasswordToken(result.link.split("/redefinir-senha/")[1]);
    expect(token?.purpose).toBe("INVITE");
  });

  it("aproveita conta existente (profissional que atende em outro salão)", async () => {
    const a = await createTestSalon();
    const b = await createTestSalon();
    await grantProfessionalAccess({ salonId: a.salon.id, professionalId: a.professional.id, email: "joao@x.com" });
    await grantProfessionalAccess({ salonId: b.salon.id, professionalId: b.professional.id, email: "joao@x.com" });
    expect(await prisma.user.count({ where: { email: "joao@x.com" } })).toBe(1);
  });

  it("recusa e-mail de dono de salão", async () => {
    const a = await createTestSalon();
    const b = await createTestSalon();
    await expect(
      grantProfessionalAccess({ salonId: a.salon.id, professionalId: a.professional.id, email: b.owner.email })
    ).rejects.toMatchObject({ code: "EMAIL_IS_OWNER" });
  });

  it("recusa profissional que já tem acesso e e-mail já usado por outro profissional do salão", async () => {
    const t = await createTestSalon();
    const other = await prisma.professional.create({ data: { salonId: t.salon.id, name: "Pedro" } });
    await grantProfessionalAccess({ salonId: t.salon.id, professionalId: t.professional.id, email: "joao@x.com" });
    await expect(
      grantProfessionalAccess({ salonId: t.salon.id, professionalId: t.professional.id, email: "outro@x.com" })
    ).rejects.toMatchObject({ code: "ALREADY_LINKED" });
    await expect(grantProfessionalAccess({ salonId: t.salon.id, professionalId: other.id, email: "joao@x.com" })).rejects.toMatchObject({
      code: "ALREADY_LINKED",
    });
  });

  it("não mexe em profissional de outro salão", async () => {
    const a = await createTestSalon();
    const b = await createTestSalon();
    await expect(
      grantProfessionalAccess({ salonId: a.salon.id, professionalId: b.professional.id, email: "x@x.com" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("reenvio gera link novo; revogação desvincula e apaga os aparelhos", async () => {
    const t = await createTestSalon();
    const { userId } = await grantProfessionalAccess({ salonId: t.salon.id, professionalId: t.professional.id, email: "joao@x.com" });
    const again = await resendProfessionalLink(t.salon.id, t.professional.id);
    expect(again.link).toContain("/redefinir-senha/");

    await prisma.pushSubscription.create({
      data: { endpoint: "https://push/1", p256dh: "p", auth: "a", salonId: t.salon.id, userId },
    });
    await revokeProfessionalAccess(t.salon.id, t.professional.id);
    expect((await prisma.professional.findUniqueOrThrow({ where: { id: t.professional.id } })).userId).toBeNull();
    expect(await prisma.pushSubscription.count()).toBe(0);
    await expect(resendProfessionalLink(t.salon.id, t.professional.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("resolveMember", () => {
  it("dono entra como OWNER", async () => {
    const t = await createTestSalon();
    expect((await resolveMember({ userId: t.owner.id, issuedAt: nowSec() }))?.role).toBe("OWNER");
  });

  it("profissional com acesso entra como PROFESSIONAL do salão certo", async () => {
    const t = await createTestSalon();
    const { userId } = await grantProfessionalAccess({ salonId: t.salon.id, professionalId: t.professional.id, email: "joao@x.com" });
    const member = await resolveMember({ userId, issuedAt: nowSec() });
    expect(member).toMatchObject({ role: "PROFESSIONAL", salon: { id: t.salon.id }, professional: { id: t.professional.id } });
  });

  it("profissional inativado ou sem acesso não entra", async () => {
    const t = await createTestSalon();
    const { userId } = await grantProfessionalAccess({ salonId: t.salon.id, professionalId: t.professional.id, email: "joao@x.com" });
    await prisma.professional.update({ where: { id: t.professional.id }, data: { active: false } });
    expect(await resolveMember({ userId, issuedAt: nowSec() })).toBeNull();
    await prisma.professional.update({ where: { id: t.professional.id }, data: { active: true, userId: null } });
    expect(await resolveMember({ userId, issuedAt: nowSec() })).toBeNull();
  });

  it("conta bloqueada ou sessão anterior à troca de senha não entra", async () => {
    const t = await createTestSalon();
    await prisma.user.update({ where: { id: t.owner.id }, data: { passwordChangedAt: new Date() } });
    expect(await resolveMember({ userId: t.owner.id, issuedAt: nowSec() - 3600 })).toBeNull();
    await prisma.user.update({ where: { id: t.owner.id }, data: { passwordChangedAt: null, disabledAt: new Date() } });
    expect(await resolveMember({ userId: t.owner.id, issuedAt: nowSec() })).toBeNull();
    expect(await resolveMember(null)).toBeNull();
  });
});

describe("agenda e desfecho do profissional", () => {
  it("vê só os próprios atendimentos, inclusive passados ainda sem desfecho", async () => {
    const t = await createTestSalon();
    const other = await prisma.professional.create({ data: { salonId: t.salon.id, name: "Pedro" } });
    await prisma.serviceProfessional.create({ data: { serviceId: t.service.id, professionalId: other.id } });
    await prisma.availability.createMany({
      data: Array.from({ length: 7 }, (_, weekday) => ({ professionalId: other.id, weekday, startTime: "00:00", endTime: "23:59" })),
    });
    const mine = await book(t, t.professional.id, 30);
    const pending = await book(t, t.professional.id, -30, "11999991111");
    await book(t, other.id, 30, "11999992222");
    const farFuture = await book(t, t.professional.id, 24 * 20, "11999993333");

    const ids = (await getProfessionalAgenda(t.professional.id)).map((a) => a.id);
    expect(ids).toContain(mine.id);
    expect(ids).toContain(pending.id);
    expect(ids).not.toContain(farFuture.id);
    expect(ids).toHaveLength(2);
  });

  it("setAppointmentOutcome com professionalId não alcança atendimento de outro profissional", async () => {
    const t = await createTestSalon();
    const other = await prisma.professional.create({ data: { salonId: t.salon.id, name: "Pedro" } });
    const appt = await book(t, t.professional.id, -2);
    const denied = await setAppointmentOutcome({ salonId: t.salon.id, appointmentId: appt.id, outcome: "COMPLETED", professionalId: other.id, actor: "PROFESSIONAL" });
    expect(denied).toEqual({ ok: false, reason: "NOT_FOUND" });

    const ok = await setAppointmentOutcome({ salonId: t.salon.id, appointmentId: appt.id, outcome: "COMPLETED", professionalId: t.professional.id, actor: "PROFESSIONAL" });
    expect(ok).toEqual({ ok: true });
    const event = await prisma.appointmentEvent.findFirstOrThrow({ where: { appointmentId: appt.id, type: "COMPLETED" } });
    expect(event.actor).toBe("PROFESSIONAL");
  });
});
