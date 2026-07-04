-- AlterTable
ALTER TABLE "users" ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "loginFailures" INTEGER NOT NULL DEFAULT 0;
