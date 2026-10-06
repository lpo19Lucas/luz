-- Acesso do profissional (Fase P). Só adições.

-- AlterTable
ALTER TABLE "professionals" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "professionals_salonId_userId_key" ON "professionals"("salonId", "userId");

-- AddForeignKey
ALTER TABLE "professionals" ADD CONSTRAINT "professionals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

