-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "companyEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "companyPhone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "termsAndConditions" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cargoDescription" TEXT,
ADD COLUMN     "cargoHeightCm" DECIMAL(8,2),
ADD COLUMN     "cargoLengthCm" DECIMAL(8,2),
ADD COLUMN     "cargoQuantity" INTEGER,
ADD COLUMN     "cargoWeightKg" DECIMAL(10,2),
ADD COLUMN     "cargoWidthCm" DECIMAL(8,2);
