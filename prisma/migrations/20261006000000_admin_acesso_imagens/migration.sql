-- Painel admin, recuperação de acesso e imagens de profissional/serviço.
-- Só adições (a DATABASE_URL de preview aponta pro banco de produção).

-- CreateEnum
CREATE TYPE "PasswordTokenPurpose" AS ENUM ('RESET', 'INVITE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "passwordChangedAt" TIMESTAMP(3),
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT;

-- AlterTable
ALTER TABLE "professionals" ADD COLUMN     "photoImageId" TEXT;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "imageId" TEXT;

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" "PasswordTokenPurpose" NOT NULL DEFAULT 'RESET',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_images" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_plans" (
    "plan" "SubscriptionPlan" NOT NULL,
    "label" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_plans_pkey" PRIMARY KEY ("plan")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_createdAt_idx" ON "password_reset_tokens"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "stored_images_salonId_idx" ON "stored_images"("salonId");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_images" ADD CONSTRAINT "stored_images_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Planos atuais (antes fixos em src/lib/plans.ts) viram linhas editáveis.
INSERT INTO "platform_plans" ("plan", "label", "priceCents", "durationDays", "description", "active", "sortOrder", "updatedAt") VALUES
  ('TRIAL',     'Teste grátis', 0,     50,  NULL, true, 0, CURRENT_TIMESTAMP),
  ('MONTHLY',   'Mensal',       7900,  30,  'cobrado todo mês', true, 1, CURRENT_TIMESTAMP),
  ('QUARTERLY', 'Trimestral',   20700, 90,  NULL, true, 2, CURRENT_TIMESTAMP),
  ('YEARLY',    'Anual',        70800, 365, NULL, true, 3, CURRENT_TIMESTAMP)
ON CONFLICT ("plan") DO NOTHING;

-- CreateTable
CREATE TABLE "auth_attempts" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auth_attempts_key_createdAt_idx" ON "auth_attempts"("key", "createdAt");
