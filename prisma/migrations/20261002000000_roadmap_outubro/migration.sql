-- Roadmap de outubro/2026: perfil do salão (F3), onboarding (F12), bloqueios
-- recorrentes (F4), histórico de eventos (F5), clientes banidos (F7),
-- agendamento pelo dono (B3), templates de mensagem (F9) e produtos (F13).
-- Tudo aditivo: nenhuma coluna existente muda de tipo nem é removida.

-- CreateEnum
CREATE TYPE "AgendaBlockRecurrence" AS ENUM ('ONCE', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('ONLINE', 'OWNER');

-- CreateEnum
CREATE TYPE "AppointmentEventType" AS ENUM ('CREATED', 'CANCELLED', 'RESCHEDULED', 'PRESENCE_CONFIRMED', 'COMPLETED', 'NO_SHOW', 'OUTCOME_REVERTED');

-- CreateEnum
CREATE TYPE "AppointmentEventActor" AS ENUM ('CLIENT', 'OWNER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ProductReservationStatus" AS ENUM ('PENDING', 'DELIVERED', 'CANCELLED');

-- AlterTable
ALTER TABLE "salons" ADD COLUMN     "accentColor" TEXT,
ADD COLUMN     "addressCity" TEXT,
ADD COLUMN     "addressComplement" TEXT,
ADD COLUMN     "addressNeighborhood" TEXT,
ADD COLUMN     "addressNumber" TEXT,
ADD COLUMN     "addressState" TEXT,
ADD COLUMN     "addressStreet" TEXT,
ADD COLUMN     "addressZip" TEXT,
ADD COLUMN     "cnpj" TEXT,
ADD COLUMN     "coverImageData" TEXT,
ADD COLUMN     "coverImageUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "facebookUrl" TEXT,
ADD COLUMN     "faqJson" JSONB,
ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "primaryColor" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "tiktokUrl" TEXT,
ADD COLUMN     "websiteUrl" TEXT,
ADD COLUMN     "whatsappPhone" TEXT;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "banReason" TEXT,
ADD COLUMN     "bannedAt" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "source" "AppointmentSource" NOT NULL DEFAULT 'ONLINE';

-- CreateTable
CREATE TABLE "agenda_blocks" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "professionalId" TEXT,
    "recurrence" "AgendaBlockRecurrence" NOT NULL DEFAULT 'ONCE',
    "date" DATE,
    "weekday" INTEGER,
    "startsOn" DATE,
    "endsOn" DATE,
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agenda_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_events" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "type" "AppointmentEventType" NOT NULL,
    "actor" "AppointmentEventActor" NOT NULL,
    "previousStartAt" TIMESTAMP(3),
    "newStartAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "type" "WhatsAppJobType" NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "imageData" TEXT,
    "imageUpdatedAt" TIMESTAMP(3),
    "stock" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_reservations" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL,
    "status" "ProductReservationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agenda_blocks_salonId_idx" ON "agenda_blocks"("salonId");

-- CreateIndex
CREATE INDEX "agenda_blocks_professionalId_idx" ON "agenda_blocks"("professionalId");

-- CreateIndex
CREATE INDEX "appointment_events_salonId_type_createdAt_idx" ON "appointment_events"("salonId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "appointment_events_appointmentId_idx" ON "appointment_events"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_salonId_type_key" ON "message_templates"("salonId", "type");

-- CreateIndex
CREATE INDEX "products_salonId_idx" ON "products"("salonId");

-- CreateIndex
CREATE INDEX "product_reservations_salonId_status_idx" ON "product_reservations"("salonId", "status");

-- AddForeignKey
ALTER TABLE "agenda_blocks" ADD CONSTRAINT "agenda_blocks_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_blocks" ADD CONSTRAINT "agenda_blocks_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "professionals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_events" ADD CONSTRAINT "appointment_events_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reservations" ADD CONSTRAINT "product_reservations_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reservations" ADD CONSTRAINT "product_reservations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reservations" ADD CONSTRAINT "product_reservations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reservations" ADD CONSTRAINT "product_reservations_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ------------------------------------------------------------------
-- Dados
-- ------------------------------------------------------------------

-- Salões que já existiam antes do onboarding (F12) continuam com o link no ar.
UPDATE "salons" SET "publishedAt" = CURRENT_TIMESTAMP WHERE "publishedAt" IS NULL;

-- Bloqueios pontuais antigos (availability_exceptions) viram AgendaBlock ONCE.
INSERT INTO "agenda_blocks" ("id", "salonId", "professionalId", "recurrence", "date", "startTime", "endTime", "reason")
SELECT 'legacy_' || ae."id", p."salonId", ae."professionalId", 'ONCE', ae."date", ae."startTime", ae."endTime", ae."reason"
FROM "availability_exceptions" ae
JOIN "professionals" p ON p."id" = ae."professionalId";

-- Telefones passam a ser guardados só com dígitos (busca, banimento e link de
-- WhatsApp dependem disso). Normaliza os existentes quando não gera conflito
-- com outro cliente do mesmo salão.
UPDATE "clients" c
SET "phone" = regexp_replace(c."phone", '\D', '', 'g')
WHERE c."phone" ~ '\D'
  AND NOT EXISTS (
    SELECT 1 FROM "clients" o
    WHERE o."salonId" = c."salonId"
      AND o."id" <> c."id"
      AND regexp_replace(o."phone", '\D', '', 'g') = regexp_replace(c."phone", '\D', '', 'g')
  );
