-- Preferências de notificação por pessoa (Fase E3). Só adição.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mutedNotifications" "NotificationType"[] DEFAULT ARRAY[]::"NotificationType"[];

