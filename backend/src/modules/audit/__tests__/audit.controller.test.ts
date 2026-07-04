import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import request from 'supertest';

// ── Hoist test dir so vi.mock factory can reference it ────────────────────────
const TEST_DIR = vi.hoisted(() =>
  require('path').join(require('os').tmpdir(), 'tms-audit-ctrl-test'),
);

vi.mock('../../../config/paths', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../config/paths.js')>();
  return { ...actual, AUDIT_LOG_DIR: TEST_DIR };
});

import { app }       from '../../../app.js';
import { authHeader } from '../../../__tests__/helpers/auth.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CURRENT_FILE = 'audit-current.jsonl';
const currentPath  = path.join(TEST_DIR, CURRENT_FILE);

const entryBackupInfo = JSON.stringify({
  timestamp: '2026-05-04T10:00:00.000Z',
  category:  'BACKUP',
  action:    'BACKUP_CREATE',
  severity:  'INFO',
  actor:     { userId: 1, email: 'admin@tms.ro' },
  details:   { filename: 'test.tar.gz' },
});

const entryAuthWarn = JSON.stringify({
  timestamp: '2026-05-04T09:00:00.000Z',
  category:  'AUTH',
  action:    'AUTH_LOGIN_FAIL',
  severity:  'WARN',
  actor:     { userId: 2, email: 'user@tms.ro' },
  details:   {},
});

beforeAll(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.writeFileSync(currentPath, `${entryBackupInfo}\n${entryAuthWarn}\n`);
});

afterAll(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── GET /api/audit/files ──────────────────────────────────────────────────────

describe('GET /api/audit/files', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/audit/files');
    expect(res.status).toBe(401);
  });

  it('returns empty array when audit dir does not exist', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const res = await request(app)
      .get('/api/audit/files')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('returns current file when it exists', async () => {
    const res = await request(app)
      .get('/api/audit/files')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    const files = res.body.data as Array<{ name: string; compressed: boolean }>;
    const current = files.find((f) => f.name === CURRENT_FILE);
    expect(current).toBeDefined();
    expect(current?.compressed).toBe(false);
  });

  it('includes archive files sorted newest first', async () => {
    const archive1 = path.join(TEST_DIR, 'audit-2026-05-01.jsonl.gz');
    const archive2 = path.join(TEST_DIR, 'audit-2026-05-02.jsonl.gz');
    fs.writeFileSync(archive1, '');
    fs.writeFileSync(archive2, '');

    const res = await request(app)
      .get('/api/audit/files')
      .set('Authorization', authHeader());

    const files = res.body.data as Array<{ date: string; compressed: boolean }>;
    const archives = files.filter((f) => f.compressed);
    expect(archives.length).toBeGreaterThanOrEqual(2);
    expect(archives[0].date >= archives[1].date).toBe(true);

    fs.unlinkSync(archive1);
    fs.unlinkSync(archive2);
  });

  it('skips files that do not match archive pattern', async () => {
    const junk = path.join(TEST_DIR, 'random-file.txt');
    fs.writeFileSync(junk, '');

    const res = await request(app)
      .get('/api/audit/files')
      .set('Authorization', authHeader());

    const files = res.body.data as Array<{ name: string }>;
    expect(files.find((f) => f.name === 'random-file.txt')).toBeUndefined();

    fs.unlinkSync(junk);
  });
});

// ── GET /api/audit/entries ────────────────────────────────────────────────────

describe('GET /api/audit/entries', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/audit/entries');
    expect(res.status).toBe(401);
  });

  it('returns entries from today\'s file when no date param given', async () => {
    const res = await request(app)
      .get('/api/audit/entries')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.entries).toHaveLength(2);
  });

  it('returns empty result when archive file does not exist', async () => {
    const res = await request(app)
      .get('/api/audit/entries?date=2020-01-01')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.entries).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  it('filters by category', async () => {
    const res = await request(app)
      .get('/api/audit/entries?category=BACKUP')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.entries[0].category).toBe('BACKUP');
  });

  it('filters by severity', async () => {
    const res = await request(app)
      .get('/api/audit/entries?severity=WARN')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.entries[0].severity).toBe('WARN');
  });

  it('filters by actorEmail (case-insensitive substring)', async () => {
    const res = await request(app)
      .get('/api/audit/entries?actorEmail=USER')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.entries[0].actor.email).toBe('user@tms.ro');
  });

  it('filters by free-text q', async () => {
    const res = await request(app)
      .get('/api/audit/entries?q=test.tar.gz')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.entries[0].action).toBe('BACKUP_CREATE');
  });

  it('respects page and pageSize', async () => {
    const res = await request(app)
      .get('/api/audit/entries?page=1&pageSize=1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.entries).toHaveLength(1);
  });

  it('returns newest entry first (sorted by timestamp desc)', async () => {
    const res = await request(app)
      .get('/api/audit/entries')
      .set('Authorization', authHeader());

    const entries = res.body.data.entries as Array<{ timestamp: string }>;
    expect(entries[0].timestamp > entries[1].timestamp).toBe(true);
  });
});

// ── GET /api/audit/download ───────────────────────────────────────────────────

describe('GET /api/audit/download', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/audit/download');
    expect(res.status).toBe(401);
  });

  it('streams today\'s file with correct Content-Disposition', async () => {
    const res = await request(app)
      .get('/api/audit/download')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain(CURRENT_FILE);
    expect(res.headers['content-type']).toBe('application/octet-stream');
  });

  it('streams today\'s file when date=today explicitly given', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await request(app)
      .get(`/api/audit/download?date=${today}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain(CURRENT_FILE);
  });

  it('returns 404 when archive date has no file', async () => {
    const res = await request(app)
      .get('/api/audit/download?date=2020-01-01')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
