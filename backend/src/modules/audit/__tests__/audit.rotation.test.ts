import { vi, describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

vi.mock('../../../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../config/paths', () => ({ AUDIT_LOG_DIR: '/tmp/tms-test-audit' }));

const AUDIT_LOG_DIR = '/tmp/tms-test-audit';

// Mock stream/promises pipeline — we don't actually gzip in unit tests
vi.mock('stream/promises', () => ({ pipeline: vi.fn().mockResolvedValue(undefined) }));

// Mock zlib and fs streams used by gzipFile
vi.mock('zlib', () => ({
  default:    { createGzip: vi.fn(() => ({})) },
  createGzip: vi.fn(() => ({})),
}));

import { rotateAuditLogIfDue } from '../audit.rotation.js';

const CURRENT_LOG = 'audit-current.jsonl';
const currentPath = path.join(AUDIT_LOG_DIR, CURRENT_LOG);

function mockStat(mtime: Date) {
  vi.spyOn(fs, 'statSync').mockReturnValue({ mtime } as ReturnType<typeof fs.statSync>);
}

function yesterday(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
}

function eightDaysAgo(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 8);
  return d;
}

function archiveName(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `audit-${y}-${m}-${d}.jsonl.gz`;
}

describe('rotateAuditLogIfDue', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('is a no-op when audit-current.jsonl does not exist', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const statSpy = vi.spyOn(fs, 'statSync');

    await rotateAuditLogIfDue();

    expect(statSpy).not.toHaveBeenCalled();
  });

  it('is a no-op when mtime is today', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    mockStat(new Date()); // today

    const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockReturnValue(undefined);

    await rotateAuditLogIfDue();

    expect(unlinkSpy).not.toHaveBeenCalled();
  });

  it('gzips and deletes current when mtime is yesterday', async () => {
    const yd = yesterday();
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      if (String(p) === currentPath) return true;
      return false; // archive doesn't exist yet
    });
    mockStat(yd);
    vi.spyOn(fs, 'createReadStream').mockReturnValue({} as ReturnType<typeof fs.createReadStream>);
    vi.spyOn(fs, 'createWriteStream').mockReturnValue({} as ReturnType<typeof fs.createWriteStream>);
    vi.spyOn(fs, 'readdirSync').mockReturnValue([] as unknown as ReturnType<typeof fs.readdirSync>);
    const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockReturnValue(undefined);

    await rotateAuditLogIfDue();

    expect(unlinkSpy).toHaveBeenCalledWith(currentPath);
    // createWriteStream should have been called with the archive path
    const expectedArchive = path.join(AUDIT_LOG_DIR, archiveName(yd));
    expect(fs.createWriteStream).toHaveBeenCalledWith(expectedArchive);
  });

  it('is idempotent — deletes current without re-gzipping if archive already exists', async () => {
    const yd = yesterday();
    const archivePath = path.join(AUDIT_LOG_DIR, archiveName(yd));

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      return String(p) === currentPath || String(p) === archivePath;
    });
    mockStat(yd);
    vi.spyOn(fs, 'readdirSync').mockReturnValue([] as unknown as ReturnType<typeof fs.readdirSync>);
    const unlinkSpy   = vi.spyOn(fs, 'unlinkSync').mockReturnValue(undefined);
    const writeSpy    = vi.spyOn(fs, 'createWriteStream');

    await rotateAuditLogIfDue();

    expect(unlinkSpy).toHaveBeenCalledWith(currentPath);
    expect(writeSpy).not.toHaveBeenCalled(); // gzip skipped — already archived
  });

  it('prunes archives older than 7 days', async () => {
    const yd  = yesterday();
    const old = eightDaysAgo();
    const oldName = archiveName(old);

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => String(p) === currentPath);
    mockStat(yd);
    vi.spyOn(fs, 'createReadStream').mockReturnValue({} as ReturnType<typeof fs.createReadStream>);
    vi.spyOn(fs, 'createWriteStream').mockReturnValue({} as ReturnType<typeof fs.createWriteStream>);
    vi.spyOn(fs, 'readdirSync').mockReturnValue([oldName] as unknown as ReturnType<typeof fs.readdirSync>);
    const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockReturnValue(undefined);

    await rotateAuditLogIfDue();

    const deletedPaths = unlinkSpy.mock.calls.map((c) => String(c[0]));
    expect(deletedPaths).toContain(path.join(AUDIT_LOG_DIR, oldName));
  });
});
