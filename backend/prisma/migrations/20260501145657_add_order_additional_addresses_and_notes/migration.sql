-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "additionalDeliveriesJson" TEXT,
ADD COLUMN     "additionalPickupsJson" TEXT,
ADD COLUMN     "internalNotes" TEXT;
