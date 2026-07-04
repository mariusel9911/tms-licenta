-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "auditAuthEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "auditBackupEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "auditSettingsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "auditUserMgmtEnabled" BOOLEAN NOT NULL DEFAULT true;
