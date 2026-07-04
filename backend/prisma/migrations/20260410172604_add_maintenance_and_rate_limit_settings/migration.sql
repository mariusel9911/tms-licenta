-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "maintenanceEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maintenanceMessage" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "rateLimitEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "rateLimitPerUser" INTEGER NOT NULL DEFAULT 50;
