-- Revert tiered backup retention: remove daily/weekly/monthly fields,
-- restore single autoBackupRetainCount field.

ALTER TABLE "app_settings"
  DROP COLUMN IF EXISTS "backupRetainDaily",
  DROP COLUMN IF EXISTS "backupRetainWeekly",
  DROP COLUMN IF EXISTS "backupRetainMonthly";

ALTER TABLE "app_settings"
  ADD COLUMN IF NOT EXISTS "autoBackupRetainCount" INTEGER NOT NULL DEFAULT 7;
