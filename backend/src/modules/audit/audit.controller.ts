import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { createInterface } from 'readline';
import type { Request, Response } from 'express';
import { AUDIT_LOG_DIR } from '../../config/paths.js';
import type { AuditEntry, AuditFileInfo, AuditEntriesQuery } from './audit.types.js';
import { AuditCategory, AuditSeverity } from './audit.types.js';

const CURRENT_FILE = 'audit-current.jsonl';
const ARCHIVE_RE   = /^audit-(\d{4}-\d{2}-\d{2})\.jsonl\.gz$/;

function listAuditFiles(): AuditFileInfo[] {
  if (!fs.existsSync(AUDIT_LOG_DIR)) return [];

  const files: AuditFileInfo[] = [];
  const today = new Date().toISOString().slice(0, 10);

  const currentPath = path.join(AUDIT_LOG_DIR, CURRENT_FILE);
  if (fs.existsSync(currentPath)) {
    const stat = fs.statSync(currentPath);
    files.push({ name: CURRENT_FILE, date: today, sizeBytes: stat.size, compressed: false });
  }

  for (const f of fs.readdirSync(AUDIT_LOG_DIR)) {
    const m = f.match(ARCHIVE_RE);
    if (!m) continue;
    const stat = fs.statSync(path.join(AUDIT_LOG_DIR, f));
    files.push({ name: f, date: m[1], sizeBytes: stat.size, compressed: true });
  }

  // Sort newest first
  return files.sort((a, b) => b.date.localeCompare(a.date));
}

/** Read all lines from a file (gzipped or plain), filter, paginate. */
async function readEntries(
  filePath: string,
  compressed: boolean,
  query: AuditEntriesQuery,
): Promise<{ entries: AuditEntry[]; total: number }> {
  const page     = Math.max(1, query.page     ?? 1);
  const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 50));

  const allEntries: AuditEntry[] = [];

  const stream = compressed
    ? fs.createReadStream(filePath).pipe(zlib.createGunzip())
    : fs.createReadStream(filePath);

  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    let entry: AuditEntry;
    try {
      entry = JSON.parse(line) as AuditEntry;
    } catch {
      continue;
    }

    if (query.category && entry.category !== query.category) continue;
    if (query.severity  && entry.severity  !== query.severity)  continue;
    if (query.actorEmail) {
      if (!entry.actor?.email?.toLowerCase().includes(query.actorEmail.toLowerCase())) continue;
    }
    if (query.q) {
      const needle = query.q.toLowerCase();
      const hay    = JSON.stringify(entry).toLowerCase();
      if (!hay.includes(needle)) continue;
    }

    allEntries.push(entry);
  }

  // Sort newest first
  allEntries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const total  = allEntries.length;
  const start  = (page - 1) * pageSize;
  const entries = allEntries.slice(start, start + pageSize);

  return { entries, total };
}

export const getAuditFiles = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({ success: true, data: listAuditFiles() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getAuditEntries = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, category, severity, actorEmail, q, page, pageSize } = req.query as Record<string, string | undefined>;

    const today = new Date().toISOString().slice(0, 10);
    const targetDate = date ?? today;

    // Locate the correct file
    let filePath: string;
    let compressed: boolean;

    if (targetDate === today) {
      filePath   = path.join(AUDIT_LOG_DIR, CURRENT_FILE);
      compressed = false;
    } else {
      filePath   = path.join(AUDIT_LOG_DIR, `audit-${targetDate}.jsonl.gz`);
      compressed = true;
    }

    if (!fs.existsSync(filePath)) {
      res.json({ success: true, data: { entries: [], total: 0, page: 1, pageSize: 50 } });
      return;
    }

    const query: AuditEntriesQuery = {
      category:   category as AuditCategory | undefined,
      severity:   severity as AuditSeverity | undefined,
      actorEmail,
      q,
      page:       page     ? parseInt(page,     10) : 1,
      pageSize:   pageSize ? parseInt(pageSize, 10) : 50,
    };

    const { entries, total } = await readEntries(filePath, compressed, query);

    res.json({
      success: true,
      data: {
        entries,
        total,
        page:     query.page,
        pageSize: query.pageSize,
      },
    });
  } catch (error) {
    req.log.error({ err: error }, 'getAuditEntries failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const downloadAuditFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date } = req.query as { date?: string };
    const today = new Date().toISOString().slice(0, 10);
    const targetDate = date ?? today;

    let filename: string;
    let filePath: string;

    if (targetDate === today) {
      filename = CURRENT_FILE;
      filePath = path.join(AUDIT_LOG_DIR, CURRENT_FILE);
    } else {
      filename = `audit-${targetDate}.jsonl.gz`;
      filePath = path.join(AUDIT_LOG_DIR, filename);
    }

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'Audit log not found for this date' });
      return;
    }

    const stat = fs.statSync(filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    req.log.error({ err: error }, 'downloadAuditFile failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
