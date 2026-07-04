import cron from 'node-cron';
import { app } from './src/app.js';
import { env } from './src/config/env.js';
import { prisma } from './src/config/database.js';
import { logger } from './src/config/logger.js';
import { runAutoArchiveIfDue } from './src/jobs/auto-archive.job.js';
import { runAutoBackupIfDue } from './src/jobs/auto-backup.job.js';
import { rotateAuditLogIfDue } from './src/modules/audit/audit.rotation.js';

async function main() {
  await prisma.$connect();
  logger.info('Database connected');

  // Audit log rotation: catch up on any missed rotation from a prior downtime
  rotateAuditLogIfDue().catch((err) => logger.error({ err }, 'Audit rotation startup failed'));

  // Auto-archive: checks every minute, fires once per day at the configured time
  cron.schedule('* * * * *', async () => {
    try {
      await runAutoArchiveIfDue();
    } catch (err) {
      logger.error({ err }, 'Auto-archive: failed');
    }
  });

  // Auto-backup: checks every minute, fires at the configured frequency/time
  cron.schedule('* * * * *', async () => {
    try {
      await runAutoBackupIfDue();
    } catch (err) {
      logger.error({ err }, 'Auto-backup: failed');
    }
  });

  // Audit log rotation: checks every minute, rotates when day changes
  cron.schedule('* * * * *', async () => {
    try {
      await rotateAuditLogIfDue();
    } catch (err) {
      logger.error({ err }, 'Audit rotation: failed');
    }
  });

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV, url: env.SERVER_URL }, 'Server started');
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
