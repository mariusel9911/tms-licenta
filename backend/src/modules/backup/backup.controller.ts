import fs from 'fs';
import path from 'path';
import type { Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { backupService, BACKUP_FILENAME_REGEX, BackupIncompatibleError } from './backup.service.js';
import type { BackupMetadata } from './backup.service.js';
import { settingsService } from '../settings/settings.service.js';
import { recordAuditEvent, AuditCategory, AuditSeverity } from '../audit/audit.service.js';
import { BACKUPS_DIR } from '../../config/paths.js';

const RestoreDto = z.object({
  filename: z.string().regex(BACKUP_FILENAME_REGEX, 'Invalid backup filename'),
  dryRun:   z.boolean().default(false),
  force:    z.boolean().default(false),
});

const CreateBackupDto = z.object({
  destination: z.enum(['local', 'remote', 'both']).default('both'),
});

export const listBackups = async (req: Request, res: Response): Promise<void> => {
  try {
    const backups = await backupService.listAllBackups();
    res.json({ success: true, data: backups });
  } catch (error) {
    req.log.error({ err: error }, 'listBackups failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getCompatAll = async (req: Request, res: Response): Promise<void> => {
  try {
    const results = await backupService.getCompatAll();
    res.json({ success: true, data: results });
  } catch (error) {
    req.log.error({ err: error }, 'getCompatAll failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const createBackup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { destination } = CreateBackupDto.parse(req.body);
    const actor = { userId: req.user?.id, email: req.user?.email };

    const metadata = await backupService.createBackup(destination, actor);

    const wantRemote = (destination === 'both' || destination === 'remote') && backupService.isS3Configured();
    if (wantRemote) {
      try {
        await backupService.uploadToS3(metadata.filename, actor);
        if (destination === 'remote') {
          backupService.deleteLocalBackup(metadata.filename);
        }
      } catch (s3Err: unknown) {
        req.log.error({ err: s3Err }, 'backup: S3 upload failed after local backup');
        metadata.storage = 'local';
      }
    }

    // Apply unified retention policy (always covers both stores)
    try {
      const settings = await settingsService.get();
      const retainCount = settings.autoBackupRetainCount ?? 7;
      await backupService.pruneRetention(retainCount, actor);
    } catch (cleanupErr: unknown) {
      req.log.warn({ err: cleanupErr }, 'backup: retention cleanup failed (non-fatal)');
    }

    res.status(201).json({ success: true, data: metadata });
  } catch (error) {
    req.log.error({ err: error }, 'createBackup failed');
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ success: false, error: message });
  }
};

export const restoreBackup = async (req: Request, res: Response): Promise<void> => {
  try {
    const dto   = RestoreDto.parse(req.body);
    const actor = { userId: req.user?.id, email: req.user?.email };
    const result = await backupService.restoreFromBackup(dto.filename, dto.dryRun, dto.force, actor);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues[0]?.message ?? 'Invalid request' });
      return;
    }
    if (error instanceof BackupIncompatibleError) {
      res.status(409).json({
        success: false,
        error:   error.message,
        data:    { compatibility: error.compat },
      });
      return;
    }
    req.log.error({ err: error }, 'restoreBackup failed');
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ success: false, error: message });
  }
};

export const deleteBackup = async (req: Request, res: Response): Promise<void> => {
  try {
    const filename = req.params.filename as string;
    if (!BACKUP_FILENAME_REGEX.test(filename)) {
      res.status(400).json({ success: false, error: 'Invalid backup filename' });
      return;
    }

    backupService.deleteLocalBackup(filename);
    if (backupService.isS3Configured()) {
      await backupService.deleteFromS3(filename);
    }

    await recordAuditEvent({
      category: AuditCategory.BACKUP,
      action:   'BACKUP_DELETE',
      actor:    { userId: req.user?.id, email: req.user?.email },
      severity: AuditSeverity.WARN,
      details:  { filename },
    });

    res.json({ success: true, data: null });
  } catch (error) {
    req.log.error({ err: error }, 'deleteBackup failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const downloadBackup = async (req: Request, res: Response): Promise<void> => {
  try {
    const filename = req.params.filename as string;
    if (!BACKUP_FILENAME_REGEX.test(filename)) {
      res.status(400).json({ success: false, error: 'Invalid backup filename' });
      return;
    }

    let filePath = path.join(BACKUPS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      if (!backupService.isS3Configured()) {
        res.status(404).json({ success: false, error: 'Backup file not found' });
        return;
      }
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
      await backupService.downloadFromS3(filename, filePath);
    }

    const stat = fs.statSync(filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    req.log.error({ err: error }, 'downloadBackup failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const uploadBackup = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: 'No backup file provided' });
      return;
    }

    // Verify gzip magic bytes (0x1f 0x8b) — applies to both .sql.gz and .tar.gz
    const header = Buffer.alloc(2);
    const fd = fs.openSync(file.path, 'r');
    fs.readSync(fd, header, 0, 2, 0);
    fs.closeSync(fd);
    if (header[0] !== 0x1f || header[1] !== 0x8b) {
      fs.unlinkSync(file.path);
      res.status(400).json({ success: false, error: 'Invalid backup file format' });
      return;
    }

    const m = file.originalname.match(
      /tms-backup-(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/,
    );
    const createdAt = m
      ? new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`)
      : new Date();

    const metadata: BackupMetadata = {
      filename:  file.originalname,
      sizeBytes: file.size,
      createdAt,
      storage:   'local',
    };

    res.status(201).json({ success: true, data: metadata });
  } catch (error) {
    req.log.error({ err: error }, 'uploadBackup failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
