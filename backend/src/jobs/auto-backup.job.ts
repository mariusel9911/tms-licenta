import { logger } from '../config/logger.js';
import { backupService } from '../modules/backup/backup.service.js';
import { settingsService } from '../modules/settings/settings.service.js';
import { isMaintenanceActive } from '../middleware/maintenance.middleware.js';

const SYSTEM_ACTOR = { email: 'system@auto-backup' };

let lastBackupDate: string | null = null;

export async function runAutoBackupIfDue(): Promise<void> {
  if (await isMaintenanceActive()) {
    logger.info('Auto-backup: skipped (maintenance mode)');
    return;
  }

  let settings;
  try {
    settings = await settingsService.get();
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P1001') return;
    throw err;
  }

  if (!settings.autoBackupEnabled) return;

  const [targetHour, targetMinute] = (settings.autoBackupTime ?? '03:00')
    .split(':')
    .map(Number);
  const now = new Date();
  if (now.getHours() !== targetHour || now.getMinutes() !== targetMinute) return;

  const frequency = settings.autoBackupFrequency ?? 'DAILY';

  if (frequency === 'WEEKLY') {
    const targetDay = settings.autoBackupDay ?? 1; // default Monday
    if (now.getDay() !== targetDay) return;
  } else if (frequency === 'MONTHLY') {
    const targetDay = settings.autoBackupDay ?? 1;
    if (now.getDate() !== targetDay) return;
  }

  // Deduplication: one run per trigger window
  const today = now.toISOString().slice(0, 10);
  if (lastBackupDate === today) return;
  lastBackupDate = today;

  logger.info(
    { frequency, time: settings.autoBackupTime, day: settings.autoBackupDay },
    `Auto-backup: starting (${frequency} at ${settings.autoBackupTime})`,
  );

  const destination  = (settings.autoBackupDestination ?? 'both') as 'local' | 'remote' | 'both';
  const retainCount  = settings.autoBackupRetainCount ?? 7;

  try {
    const metadata = await backupService.createBackup(destination, SYSTEM_ACTOR);
    logger.info(
      { filename: metadata.filename, sizeBytes: metadata.sizeBytes, destination },
      'Auto-backup: backup created',
    );

    const wantRemote = (destination === 'both' || destination === 'remote') && backupService.isS3Configured();
    if (wantRemote) {
      try {
        await backupService.uploadToS3(metadata.filename, SYSTEM_ACTOR);
        logger.info({ filename: metadata.filename }, 'Auto-backup: uploaded to S3');
        if (destination === 'remote') backupService.deleteLocalBackup(metadata.filename);
      } catch (s3Err) {
        logger.error({ err: s3Err }, 'Auto-backup: S3 upload failed (local backup retained)');
      }
    }

    // Unified prune — always covers both stores regardless of destination
    const { deletedLocal, deletedRemote } = await backupService.pruneRetention(retainCount, SYSTEM_ACTOR);
    if (deletedLocal.length + deletedRemote.length > 0) {
      logger.info(
        { deletedLocal: deletedLocal.length, deletedRemote: deletedRemote.length },
        'Auto-backup: old backups pruned',
      );
    }
  } catch (err) {
    logger.error({ err }, 'Auto-backup: backup failed');
  }
}
