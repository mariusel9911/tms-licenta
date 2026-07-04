import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { pipeline } from 'stream/promises';
import { logger } from '../../config/logger.js';
import { AUDIT_LOG_DIR } from '../../config/paths.js';

const CURRENT_LOG = 'audit-current.jsonl';
const ARCHIVE_RETAIN_DAYS = 7;

function archiveFilename(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `audit-${y}-${m}-${d}.jsonl.gz`;
}

function parseArchiveDate(filename: string): Date | null {
  const m = filename.match(/^audit-(\d{4})-(\d{2})-(\d{2})\.jsonl\.gz$/);
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
}

async function gzipFile(src: string, dest: string): Promise<void> {
  const input  = fs.createReadStream(src);
  const output = fs.createWriteStream(dest);
  const gzip   = zlib.createGzip();
  await pipeline(input, gzip, output);
}

function pruneOldArchives(): void {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ARCHIVE_RETAIN_DAYS);

  const files = fs.readdirSync(AUDIT_LOG_DIR).filter(f => f.endsWith('.jsonl.gz'));
  for (const f of files) {
    const date = parseArchiveDate(f);
    if (date && date < cutoff) {
      try {
        fs.unlinkSync(path.join(AUDIT_LOG_DIR, f));
        logger.info({ file: f }, 'audit: pruned old archive');
      } catch (err) {
        logger.warn({ err, file: f }, 'audit: failed to prune old archive');
      }
    }
  }
}

/**
 * Called every minute by the cron job (and once at server startup).
 * If `audit-current.jsonl` was last modified on a prior day it is gzipped
 * into `audit-YYYY-MM-DD.jsonl.gz` and a fresh current file is started.
 * Old archives beyond ARCHIVE_RETAIN_DAYS are pruned.
 * Idempotent — safe to call multiple times.
 */
export async function rotateAuditLogIfDue(): Promise<void> {
  const currentPath = path.join(AUDIT_LOG_DIR, CURRENT_LOG);

  if (!fs.existsSync(currentPath)) return;

  let mtime: Date;
  try {
    mtime = fs.statSync(currentPath).mtime;
  } catch {
    return;
  }

  const today    = new Date();
  const isToday  =
    mtime.getFullYear() === today.getFullYear() &&
    mtime.getMonth()    === today.getMonth()    &&
    mtime.getDate()     === today.getDate();

  if (isToday) return;

  const archiveName = archiveFilename(mtime);
  const archivePath = path.join(AUDIT_LOG_DIR, archiveName);

  if (fs.existsSync(archivePath)) {
    // Already rotated (server was down for a while and we caught up)
    fs.unlinkSync(currentPath);
    pruneOldArchives();
    return;
  }

  try {
    await gzipFile(currentPath, archivePath);
    fs.unlinkSync(currentPath);
    logger.info({ archive: archiveName }, 'audit: rotated log');
    pruneOldArchives();
  } catch (err) {
    logger.error({ err }, 'audit: rotation failed');
  }
}
