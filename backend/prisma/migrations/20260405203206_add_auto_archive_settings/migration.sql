-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "autoArchiveAfterMonths" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "autoArchiveEnabled" BOOLEAN NOT NULL DEFAULT true;
