-- Reconcile: isArchived (BOOLEAN) replaced by finalizedAt (TIMESTAMP) via db push.
-- The DB already has this state applied; this file is for migration history consistency.

-- AlterTable
ALTER TABLE "orders" DROP COLUMN IF EXISTS "isArchived";
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "finalizedAt" TIMESTAMP(3);
