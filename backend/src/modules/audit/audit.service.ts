import fs from 'fs';
import path from 'path';
import { prisma } from '../../config/database.js';
import { logger } from '../../config/logger.js';
import { AUDIT_LOG_DIR } from '../../config/paths.js';
import { AuditCategory, AuditSeverity, type AuditAction, type AuditActor, type AuditEntry } from './audit.types.js';

export { AuditCategory, AuditSeverity };
export type { AuditAction, AuditActor, AuditEntry };

// ── 5-second toggle cache (mirrors ai-toggle.middleware.ts pattern) ──────────

interface AuditToggles {
  auditBackupEnabled:   boolean;
  auditAuthEnabled:     boolean;
  auditUserMgmtEnabled: boolean;
  auditSettingsEnabled: boolean;
}

const CACHE_TTL_MS = 5_000;

let cachedToggles: AuditToggles = {
  auditBackupEnabled:   true,
  auditAuthEnabled:     true,
  auditUserMgmtEnabled: true,
  auditSettingsEnabled: true,
};
let cacheExpiry = 0;

async function refreshToggles(): Promise<void> {
  try {
    const row = await prisma.appSettings.findUnique({
      where: { id: 1 },
      select: {
        auditBackupEnabled:   true,
        auditAuthEnabled:     true,
        auditUserMgmtEnabled: true,
        auditSettingsEnabled: true,
      },
    });
    if (row) cachedToggles = row;
    cacheExpiry = Date.now() + CACHE_TTL_MS;
  } catch (err) {
    logger.warn({ err }, 'audit: toggle cache refresh failed — keeping prior value');
  }
}

export function clearAuditToggleCache(): void {
  cacheExpiry = 0;
}

// ── Category → toggle mapping ─────────────────────────────────────────────────

const CATEGORY_TOGGLE: Record<AuditCategory, keyof AuditToggles> = {
  [AuditCategory.BACKUP]:    'auditBackupEnabled',
  [AuditCategory.AUTH]:      'auditAuthEnabled',
  [AuditCategory.USER_MANAGEMENT]: 'auditUserMgmtEnabled',
  [AuditCategory.SETTINGS]:  'auditSettingsEnabled',
};

// Settings-toggle audit actions must always be logged regardless of the toggle
// state — otherwise an admin can silently disable all auditing with no trace.
const ALWAYS_LOG_ACTIONS = new Set<AuditAction>([
  'SETTINGS_CHANGE',
]);

// ── Writer ────────────────────────────────────────────────────────────────────

export async function recordAuditEvent(opts: {
  category: AuditCategory;
  action:   AuditAction;
  actor:    AuditActor;
  details:  Record<string, unknown>;
  severity?: AuditSeverity;
}): Promise<void> {
  const severity = opts.severity ?? AuditSeverity.INFO;

  // Honour toggle gate (except always-log actions)
  if (!ALWAYS_LOG_ACTIONS.has(opts.action)) {
    if (Date.now() >= cacheExpiry) await refreshToggles();
    const toggleKey = CATEGORY_TOGGLE[opts.category];
    if (!cachedToggles[toggleKey]) return;
  }

  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    category:  opts.category,
    action:    opts.action,
    severity,
    actor:     opts.actor,
    details:   opts.details,
  };

  try {
    fs.mkdirSync(AUDIT_LOG_DIR, { recursive: true });
    const logPath = path.join(AUDIT_LOG_DIR, 'audit-current.jsonl');
    await fs.promises.appendFile(logPath, JSON.stringify(entry) + '\n', 'utf8');
  } catch (err) {
    // Audit failure must NEVER block the real operation
    logger.error({ err, entry }, 'audit: failed to write audit entry');
  }
}
