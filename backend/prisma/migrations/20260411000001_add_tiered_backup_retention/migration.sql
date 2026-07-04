-- Phase D: Replace count-based backup retention with tiered daily/weekly/monthly policy.
-- Drops autoBackupRetainCount (single number) and adds three separate retain limits.
-- Default values are set for existing rows before NOT NULL is enforced.

ALTER TABLE "app_settings"
  DROP COLUMN "autoBackupRetainCount";

ALTER TABLE "app_settings"
  ADD COLUMN "backupRetainDaily"   INTEGER NOT NULL DEFAULT 14,
  ADD COLUMN "backupRetainWeekly"  INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN "backupRetainMonthly" INTEGER NOT NULL DEFAULT 12;
