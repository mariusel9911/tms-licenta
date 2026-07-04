-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "autoBackupDay" INTEGER,
ADD COLUMN     "autoBackupEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoBackupFrequency" TEXT NOT NULL DEFAULT 'DAILY',
ADD COLUMN     "autoBackupRetainCount" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "autoBackupTime" TEXT NOT NULL DEFAULT '03:00';
