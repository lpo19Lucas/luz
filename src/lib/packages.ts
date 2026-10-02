import { Prisma, PrismaClient, PackageType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";

type Db = PrismaClient | Prisma.TransactionClient;

export type PackageErrorCode =
  | "DEFINITION_NOT_FOUND"
  | "DEFINITION_INACTIVE"
  | "CLIENT_NOT_FOUND"
  | "CLIENT_BANNED"
  | "PACKAGE_NOT_FOUND"
  | "NOT_PENDING";

/** Erro de negócio do fluxo de pacotes — mesmo formato de BookingError. */
export class PackageError extends Error {
  code: PackageErrorCode;
  constructor(code: PackageErrorCode) {
    super(code);
    this.name = "PackageError";
    this.code = code;
  }
}

function creditsFor(def: { type: PackageType; credits: number | null; valueCents: number | null }) {
  return {
    remainingCredits: def.type === "SERVICE_CREDITS" ? def.credits : null,
    remainingValueCents: def.type === "CASH_CREDIT" ? def.valueCents : null,
  };
}

function expiresAtFrom(activatedAt: Date, validityDays: number) {
  return new Date(activatedAt.getTime() + validityDays * 24 * 60 * 60_000);
}

/** Dono registra a venda já paga (sem gateway) — ativa o pacote na hora. */
export async function purchasePackageManually(params: {
  salonId: string;
  clientId: string;
  packageDefinitionId: string;
}) {
  const def = await prisma.packageDefinition.findFirst({
    where: { id: params.packageDefinitionId, salonId: params.salonId },
  });
  if (!def) throw new PackageError("DEFINITION_NOT_FOUND");
  if (!def.active) throw new PackageError("DEFINITION_INACTIVE");

  const client = await prisma.client.findFirst({ where: { id: params.clientId, salonId: params.salonId } });
  if (!client) throw new PackageError("CLIENT_NOT_FOUND");
  if (client.bannedAt) throw new PackageError("CLIENT_BANNED");

  const activatedAt = new Date();
  return prisma.clientPackage.create({
    data: {
      salonId: params.salonId,
      clientId: client.id,
      packageDefinitionId: def.id,
      status: "ACTIVE",
      activatedAt,
      expiresAt: expiresAtFrom(activatedAt, def.validityDays),
      ...creditsFor(def),
    },
  });
}

/** Cliente reserva pelo link público — fica PENDING_PAYMENT até o dono confirmar. */
export async function reservePackagePublic(params: {
  salonSlug: string;
  packageDefinitionId: string;
  clientName: string;
  clientPhone: string;
}) {
  const salon = await prisma.salon.findUnique({ where: { slug: params.salonSlug } });
  if (!salon) throw new PackageError("DEFINITION_NOT_FOUND");

  const def = await prisma.packageDefinition.findFirst({
    where: { id: params.packageDefinitionId, salonId: salon.id },
  });
  if (!def) throw new PackageError("DEFINITION_NOT_FOUND");
  if (!def.active) throw new PackageError("DEFINITION_INACTIVE");

  const phone = normalizePhone(params.clientPhone);
  const existing = await prisma.client.findUnique({
    where: { salonId_phone: { salonId: salon.id, phone } },
  });
  if (existing?.bannedAt) throw new PackageError("CLIENT_BANNED");

  const client = await prisma.client.upsert({
    where: { salonId_phone: { salonId: salon.id, phone } },
    update: { name: params.clientName },
    create: { salonId: salon.id, name: params.clientName, phone },
  });

  return prisma.clientPackage.create({
    data: {
      salonId: salon.id,
      clientId: client.id,
      packageDefinitionId: def.id,
      status: "PENDING_PAYMENT",
    },
  });
}

/** Dono confirma o pagamento de uma reserva pública — a validade começa a contar agora. */
export async function confirmPackagePayment(params: { salonId: string; clientPackageId: string }) {
  const clientPackage = await prisma.clientPackage.findFirst({
    where: { id: params.clientPackageId, salonId: params.salonId },
    include: { packageDefinition: true },
  });
  if (!clientPackage) throw new PackageError("PACKAGE_NOT_FOUND");
  if (clientPackage.status !== "PENDING_PAYMENT") throw new PackageError("NOT_PENDING");

  const activatedAt = new Date();
  return prisma.clientPackage.update({
    where: { id: clientPackage.id },
    data: {
      status: "ACTIVE",
      activatedAt,
      expiresAt: expiresAtFrom(activatedAt, clientPackage.packageDefinition.validityDays),
      ...creditsFor(clientPackage.packageDefinition),
    },
  });
}

/** Cancela uma reserva pendente ou um pacote ativo ainda não usado. */
export async function cancelClientPackage(params: { salonId: string; clientPackageId: string }) {
  const clientPackage = await prisma.clientPackage.findFirst({
    where: { id: params.clientPackageId, salonId: params.salonId },
  });
  if (!clientPackage) throw new PackageError("PACKAGE_NOT_FOUND");

  return prisma.clientPackage.update({ where: { id: clientPackage.id }, data: { status: "CANCELLED" } });
}

/**
 * Pacote ativo, dentro da validade, do cliente, que cubra esse serviço — usado
 * por booking.ts pra oferecer "usar pacote" e validar no momento de agendar.
 * `expiresAt` é checado aqui (não há cron de expiração: o status no banco
 * continua ACTIVE, "expirado" é só uma condição de leitura).
 */
export async function findUsablePackageForAppointment(
  params: { salonId: string; clientId: string; serviceId: string; priceCents: number },
  db: Db = prisma
) {
  const now = new Date();
  return db.clientPackage.findFirst({
    where: {
      salonId: params.salonId,
      clientId: params.clientId,
      status: "ACTIVE",
      expiresAt: { gt: now },
      OR: [
        {
          packageDefinition: { type: "SERVICE_CREDITS", serviceId: params.serviceId },
          remainingCredits: { gt: 0 },
        },
        {
          packageDefinition: { type: "CASH_CREDIT" },
          remainingValueCents: { gte: params.priceCents },
        },
      ],
    },
    include: { packageDefinition: true },
  });
}

/** Lista os pacotes de um cliente (ativos, pendentes e histórico) pra /clientes/[id]. */
export async function getClientPackages(salonId: string, clientId: string) {
  return prisma.clientPackage.findMany({
    where: { salonId, clientId },
    include: { packageDefinition: true },
    orderBy: { createdAt: "desc" },
  });
}
