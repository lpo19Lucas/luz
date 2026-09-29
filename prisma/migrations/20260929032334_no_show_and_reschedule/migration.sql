-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "noShowHandledAt" TIMESTAMP(3),
ADD COLUMN     "rescheduledCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "appointments_status_startAt_idx" ON "appointments"("status", "startAt");
