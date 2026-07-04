-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "companyStampPath" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "applyStamp" BOOLEAN NOT NULL DEFAULT false;
