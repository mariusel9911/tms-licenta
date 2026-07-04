import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import {
  backupService,
  checkBackupCompatibility,
  BACKUP_FILENAME_REGEX,
  type BackupManifest,
} from '../backup.service.js';

// ── filename regex ────────────────────────────────────────────────────────────

describe('BACKUP_FILENAME_REGEX', () => {
  it.each([
    'tms-backup-2026-04-11_03-00-00.tar.gz',
    'tms-backup-2026-04-11_03-00-00.sql.gz',
  ])('accepts valid name: %s', (name) => {
    expect(BACKUP_FILENAME_REGEX.test(name)).toBe(true);
  });

  it.each([
    'tms-backup-2026-04-11_03-00-00.zip',
    'tms-backup-2026-04-11_03-00-00.tar',
    'evil-file.tar.gz',
    'tms-backup-2026-4-11_03-00-00.tar.gz', // wrong date format
    '../../../etc/passwd',
  ])('rejects invalid name: %s', (name) => {
    expect(BACKUP_FILENAME_REGEX.test(name)).toBe(false);
  });
});

// ── isS3Configured ────────────────────────────────────────────────────────────

vi.mock('../../../config/env', () => ({
  env: {
    DATABASE_URL:        'postgresql://user:pass@localhost:5432/db',
    PG_DUMP_PATH:        'pg_dump',
    PSQL_PATH:           'psql',
    BACKUP_S3_ENDPOINT:  undefined,
    BACKUP_S3_BUCKET:    undefined,
    BACKUP_S3_REGION:    undefined,
    BACKUP_S3_ACCESS_KEY:undefined,
    BACKUP_S3_SECRET_KEY:undefined,
    BACKUP_REMOTE_REQUIRED: false,
  },
}));

vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('backupService.isS3Configured', () => {
  it('returns false when no S3 env vars set', () => {
    expect(backupService.isS3Configured()).toBe(false);
  });
});

// ── verifyBackup — legacy .sql.gz ─────────────────────────────────────────────

describe('backupService.verifyBackup (legacy sql.gz)', () => {
  const validName = 'tms-backup-2026-04-11_03-00-00.sql.gz';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns invalid for missing file', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const result = await backupService.verifyBackup(validName);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/not found locally/i);
  });

  it('returns valid for a proper gzip file', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const mockFd = 42;
    vi.spyOn(fs, 'openSync').mockReturnValue(mockFd);
    vi.spyOn(fs, 'readSync').mockImplementation((_fd, buffer) => {
      (buffer as Buffer)[0] = 0x1f;
      (buffer as Buffer)[1] = 0x8b;
      return 2;
    });
    vi.spyOn(fs, 'closeSync').mockReturnValue(undefined);

    const result = await backupService.verifyBackup(validName);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns invalid for a non-gzip file', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const mockFd = 42;
    vi.spyOn(fs, 'openSync').mockReturnValue(mockFd);
    vi.spyOn(fs, 'readSync').mockImplementation((_fd, buffer) => {
      (buffer as Buffer)[0] = 0x50; // PK (ZIP magic)
      (buffer as Buffer)[1] = 0x4b;
      return 2;
    });
    vi.spyOn(fs, 'closeSync').mockReturnValue(undefined);

    const result = await backupService.verifyBackup(validName);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/not a valid gzip/i);
  });

  it('rejects an invalid filename', async () => {
    const result = await backupService.verifyBackup('../etc/passwd');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/invalid backup filename/i);
  });
});

// ── restoreFromBackup dry-run ─────────────────────────────────────────────────

describe('backupService.restoreFromBackup — dryRun=true', () => {
  const validName = 'tms-backup-2026-04-11_03-00-00.sql.gz';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns { dryRun: true } when verification passes', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const mockFd = 42;
    vi.spyOn(fs, 'openSync').mockReturnValue(mockFd);
    vi.spyOn(fs, 'readSync').mockImplementation((_fd, buffer) => {
      (buffer as Buffer)[0] = 0x1f;
      (buffer as Buffer)[1] = 0x8b;
      return 2;
    });
    vi.spyOn(fs, 'closeSync').mockReturnValue(undefined);

    const result = await backupService.restoreFromBackup(validName, true);
    expect(result.dryRun).toBe(true);
  });

  it('returns { dryRun: true } for legacy .sql.gz even with bad bytes (no verification in dryRun)', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const mockFd = 42;
    vi.spyOn(fs, 'openSync').mockReturnValue(mockFd);
    vi.spyOn(fs, 'readSync').mockImplementation((_fd, buffer) => {
      (buffer as Buffer)[0] = 0x00; // not gzip
      (buffer as Buffer)[1] = 0x00;
      return 2;
    });
    vi.spyOn(fs, 'closeSync').mockReturnValue(undefined);

    // .sql.gz dryRun skips file verification — returns ok regardless of magic bytes
    const result = await backupService.restoreFromBackup(validName, true);
    expect(result.dryRun).toBe(true);
  });

  it('throws on invalid filename', async () => {
    await expect(backupService.restoreFromBackup('../etc/passwd', true))
      .rejects.toThrow(/invalid backup filename/i);
  });
});

// ── BACKUP_REMOTE_REQUIRED guard ─────────────────────────────────────────────

describe('backupService.createBackup — BACKUP_REMOTE_REQUIRED guard', () => {
  it('throws when BACKUP_REMOTE_REQUIRED=true and S3 not configured', async () => {
    // Temporarily override env mock
    const envModule = await import('../../../config/env');
    const originalRequired = envModule.env.BACKUP_REMOTE_REQUIRED;
    (envModule.env as { BACKUP_REMOTE_REQUIRED: boolean }).BACKUP_REMOTE_REQUIRED = true;

    try {
      await expect(backupService.createBackup('local')).rejects.toThrow(
        /BACKUP_REMOTE_REQUIRED/,
      );
    } finally {
      (envModule.env as { BACKUP_REMOTE_REQUIRED: boolean }).BACKUP_REMOTE_REQUIRED = originalRequired ?? false;
    }
  });
});

// ── checkBackupCompatibility ──────────────────────────────────────────────────

function makeManifest(migrations: string[]): BackupManifest {
  return {
    createdAt:       new Date().toISOString(),
    format:          'tar.gz',
    includesUploads: false,
    prismaMigrations: migrations,
  };
}

describe('checkBackupCompatibility', () => {
  const migA = '20240101000000_init';
  const migB = '20240201000000_add_users';
  const migC = '20240301000000_add_orders';

  it('returns ok when backup and current migrations match exactly', () => {
    const result = checkBackupCompatibility(makeManifest([migA, migB]), [migA, migB]);
    expect(result.status).toBe('ok');
    expect(result.missing).toEqual([]);
    expect(result.extra).toEqual([]);
  });

  it('returns older when current has migrations the backup lacks', () => {
    // backup: A, B — current: A, B, C → C is missing from backup (downgrade risk)
    const result = checkBackupCompatibility(makeManifest([migA, migB]), [migA, migB, migC]);
    expect(result.status).toBe('older');
    expect(result.missing).toEqual([migC]);
    expect(result.extra).toEqual([]);
  });

  it('returns newer when backup has migrations current lacks', () => {
    // backup: A, B, C — current: A, B → C is extra in backup
    const result = checkBackupCompatibility(makeManifest([migA, migB, migC]), [migA, migB]);
    expect(result.status).toBe('newer');
    expect(result.extra).toEqual([migC]);
    expect(result.missing).toEqual([]);
  });

  it('prefers older over newer when both missing and extra exist', () => {
    // backup: A, C — current: A, B → missing=[B] wins (older)
    const result = checkBackupCompatibility(makeManifest([migA, migC]), [migA, migB]);
    expect(result.status).toBe('older');
    expect(result.missing).toEqual([migB]);
    expect(result.extra).toEqual([migC]);
  });

  it('returns correct migration counts', () => {
    const result = checkBackupCompatibility(makeManifest([migA, migB]), [migA, migB, migC]);
    expect(result.backupMigrationCount).toBe(2);
    expect(result.currentMigrationCount).toBe(3);
  });

  it('returns correct last migration names', () => {
    const result = checkBackupCompatibility(makeManifest([migA, migB]), [migA, migB, migC]);
    expect(result.backupLastMigration).toBe(migB);
    expect(result.currentLastMigration).toBe(migC);
  });

  it('handles empty backup migrations (legacy manifest)', () => {
    const result = checkBackupCompatibility(makeManifest([]), [migA]);
    expect(result.status).toBe('older');
    expect(result.backupMigrationCount).toBe(0);
    expect(result.backupLastMigration).toBeUndefined();
  });

  it('handles both empty — ok with no last migration', () => {
    const result = checkBackupCompatibility(makeManifest([]), []);
    expect(result.status).toBe('ok');
    expect(result.backupLastMigration).toBeUndefined();
    expect(result.currentLastMigration).toBeUndefined();
  });
});
