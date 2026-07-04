-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "autoArchiveDay" INTEGER,
ADD COLUMN     "autoArchiveFrequency" TEXT NOT NULL DEFAULT 'DAILY';
