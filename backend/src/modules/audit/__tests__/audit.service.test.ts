import { vi, describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';

// ── Mocks must be hoisted before imports ─────────────────────────────────────

const prismaMock = vi.hoisted(() => ({
  appSettings: {
    findUnique: vi.fn(),
  },
}));

vi.mock('../../../config/database', () => ({ prisma: prismaMock }));

vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../config/paths', () => ({
  AUDIT_LOG_DIR: '/tmp/tms-test-audit',
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { recordAuditEvent, clearAuditToggleCache, AuditCategory, AuditSeverity } from '../audit.service.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const actor = { userId: 1, email: 'admin@tms.ro' };

function allEnabled() {
  prismaMock.appSettings.findUnique.mockResolvedValue({
    auditBackupEnabled:   true,
    auditAuthEnabled:     true,
    auditUserMgmtEnabled: true,
    auditSettingsEnabled: true,
  });
}

function disableBackup() {
  prismaMock.appSettings.findUnique.mockResolvedValue({
    auditBackupEnabled:   false,
    auditAuthEnabled:     true,
    auditUserMgmtEnabled: true,
    auditSettingsEnabled: false,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('recordAuditEvent — file append', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    clearAuditToggleCache();
    allEnabled();
    vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
  });

  it('writes a JSONL line to audit-current.jsonl', async () => {
    const appendSpy = vi.spyOn(fs.promises, 'appendFile').mockResolvedValue();

    await recordAuditEvent({
      category: AuditCategory.BACKUP,
      action:   'BACKUP_CREATE',
      actor,
      details:  { filename: 'test.tar.gz' },
    });

    expect(appendSpy).toHaveBeenCalledOnce();
    const [filePath, content] = appendSpy.mock.calls[0]!;
    expect(String(filePath)).toContain('audit-current.jsonl');
    const entry = JSON.parse((content as string).trimEnd());
    expect(entry).toMatchObject({
      category: 'BACKUP',
      action:   'BACKUP_CREATE',
      actor:    { userId: 1, email: 'admin@tms.ro' },
      details:  { filename: 'test.tar.gz' },
      severity: 'INFO',
    });
    expect(entry.timestamp).toBeTruthy();
  });

  it('uses INFO severity by default', async () => {
    const appendSpy = vi.spyOn(fs.promises, 'appendFile').mockResolvedValue();

    await recordAuditEvent({ category: AuditCategory.AUTH, action: 'AUTH_LOGIN_FAIL', actor, details: {} });

    const entry = JSON.parse((appendSpy.mock.calls[0]![1] as string).trimEnd());
    expect(entry.severity).toBe('INFO');
  });

  it('respects explicit severity', async () => {
    const appendSpy = vi.spyOn(fs.promises, 'appendFile').mockResolvedValue();

    await recordAuditEvent({
      category: AuditCategory.AUTH,
      action:   'AUTH_LOCKOUT',
      actor,
      details:  {},
      severity: AuditSeverity.WARN,
    });

    const entry = JSON.parse((appendSpy.mock.calls[0]![1] as string).trimEnd());
    expect(entry.severity).toBe('WARN');
  });

  it('does NOT throw when appendFile fails — falls back to logger', async () => {
    vi.spyOn(fs.promises, 'appendFile').mockRejectedValue(new Error('disk full'));

    await expect(
      recordAuditEvent({ category: AuditCategory.BACKUP, action: 'BACKUP_DELETE', actor, details: {} }),
    ).resolves.toBeUndefined();
  });
});

describe('recordAuditEvent — toggle gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    clearAuditToggleCache();
    vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
  });

  it('skips write when category toggle is disabled', async () => {
    disableBackup();
    const appendSpy = vi.spyOn(fs.promises, 'appendFile').mockResolvedValue();

    await recordAuditEvent({ category: AuditCategory.BACKUP, action: 'BACKUP_CREATE', actor, details: {} });

    expect(appendSpy).not.toHaveBeenCalled();
  });

  it('always logs SETTINGS_CHANGE even when auditSettingsEnabled=false', async () => {
    disableBackup(); // also sets auditSettingsEnabled: false
    const appendSpy = vi.spyOn(fs.promises, 'appendFile').mockResolvedValue();

    await recordAuditEvent({ category: AuditCategory.SETTINGS, action: 'SETTINGS_CHANGE', actor, details: {} });

    expect(appendSpy).toHaveBeenCalledOnce();
  });

  it('uses cached toggles without re-querying DB within TTL', async () => {
    allEnabled();
    vi.spyOn(fs.promises, 'appendFile').mockResolvedValue();

    await recordAuditEvent({ category: AuditCategory.AUTH, action: 'AUTH_LOGIN_FAIL', actor, details: {} });
    await recordAuditEvent({ category: AuditCategory.AUTH, action: 'AUTH_LOGIN_FAIL', actor, details: {} });

    // DB was queried only once (cache hit on second call)
    expect(prismaMock.appSettings.findUnique).toHaveBeenCalledTimes(1);
  });

  it('re-queries DB after clearAuditToggleCache()', async () => {
    allEnabled();
    vi.spyOn(fs.promises, 'appendFile').mockResolvedValue();

    await recordAuditEvent({ category: AuditCategory.AUTH, action: 'AUTH_LOGIN_FAIL', actor, details: {} });
    clearAuditToggleCache();
    await recordAuditEvent({ category: AuditCategory.AUTH, action: 'AUTH_LOGIN_FAIL', actor, details: {} });

    expect(prismaMock.appSettings.findUnique).toHaveBeenCalledTimes(2);
  });
});
