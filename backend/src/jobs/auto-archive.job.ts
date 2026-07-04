import { logger } from '../config/logger.js';
import { ordersService } from '../modules/orders/orders.service.js';
import { settingsService } from '../modules/settings/settings.service.js';
import { isMaintenanceActive } from '../middleware/maintenance.middleware.js';

let lastArchiveDate: string | null = null;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function runAutoArchiveIfDue(): Promise<void> {
  if (await isMaintenanceActive()) {
    logger.info('Auto-archive: skipped (maintenance mode)');
    return;
  }

  let settings;
  try {
    settings = await settingsService.get();
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P1001') return;
    throw err;
  }
  if (!settings.autoArchiveEnabled) return;

  const [targetHour, targetMinute] = (settings.autoArchiveTime ?? '02:00')
    .split(':')
    .map(Number);
  const now = new Date();
  if (now.getHours() !== targetHour || now.getMinutes() !== targetMinute) return;

  const frequency = settings.autoArchiveFrequency ?? 'DAILY';

  if (frequency === 'WEEKLY') {
    const targetDay = settings.autoArchiveDay ?? 1; // default Monday
    if (now.getDay() !== targetDay) return;
  } else if (frequency === 'MONTHLY') {
    const targetDay = settings.autoArchiveDay ?? 1;
    if (now.getDate() !== targetDay) return;
  }

  // Deduplication: skip if already ran today (one run per trigger window)
  const today = now.toISOString().slice(0, 10);
  if (lastArchiveDate === today) return;

  lastArchiveDate = today;

  const dayLabel =
    frequency === 'WEEKLY'
      ? ` on ${DAY_NAMES[settings.autoArchiveDay ?? 1]}`
      : frequency === 'MONTHLY'
        ? ` on day ${settings.autoArchiveDay ?? 1} of month`
        : '';

  logger.info(
    { frequency, time: settings.autoArchiveTime, day: settings.autoArchiveDay },
    `Auto-archive: starting (${frequency}${dayLabel} at ${settings.autoArchiveTime})`,
  );

  const result = await ordersService.archiveOldOrders();
  logger.info({ archived: result.archived }, 'Auto-archive: complete');
}
