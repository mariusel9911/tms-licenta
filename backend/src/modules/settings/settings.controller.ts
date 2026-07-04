import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { settingsService } from './settings.service.js';
import { UpdateSettingsDto } from './settings.dto.js';
import { BACKEND_ROOT } from '../../config/paths.js';
import { isValidImageFile } from '../../utils/image-validator.js';
import { clearMaintenanceCache } from '../../middleware/maintenance.middleware.js';
import { clearAiToggleCache } from '../../middleware/ai-toggle.middleware.js';
import { recordAuditEvent, clearAuditToggleCache, AuditCategory, AuditSeverity } from '../audit/audit.service.js';
import { getMetricsSummary } from '../../middleware/metrics.middleware.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/database.js';

function extractSmtpError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string }).code;
  if (msg.includes('ECONNREFUSED') || code === 'ECONNREFUSED') return 'Connection refused';
  if (msg.includes('ENOTFOUND') || code === 'ENOTFOUND') return 'Host not found';
  if (msg.includes('ETIMEDOUT') || code === 'ETIMEDOUT' || code === 'ESOCKET') return 'Connection timed out';
  if (msg.includes('535') || msg.includes('534') || msg.includes('Invalid login') || msg.includes('Username and Password')) return 'Invalid credentials';
  return msg.split('\n')[0] ?? 'Connection failed';
}

export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const raw = await settingsService.get();
    const { smtpPassword, smartbillApiToken, ...rest } = raw;
    const maskedData = {
      ...rest,
      smtpPassword: smtpPassword ? '*****' : '',
      smartbillApiToken: smartbillApiToken ? '*****' : '',
    };
    if (req.user?.role !== 'ADMIN') {
      const { smtpPassword: _sp, smartbillApiToken: _sat, ...publicData } = maskedData;
      res.json({ success: true, data: publicData });
      return;
    }
    res.json({ success: true, data: maskedData });
  } catch (error) {
    req.log.error({ err: error }, 'getSettings failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Fields that should never appear in the audit log (sensitive credentials)
const SETTINGS_AUDIT_REDACT = new Set(['smtpPassword', 'smartbillApiToken']);

// Audit toggle field names — changes to these are always logged regardless of toggle state
const AUDIT_TOGGLE_FIELDS = new Set([
  'auditBackupEnabled',
  'auditAuthEnabled',
  'auditUserMgmtEnabled',
  'auditSettingsEnabled',
  'rateLimitEnabled',
  'rateLimitPerUser',
]);

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const dto = UpdateSettingsDto.parse(req.body);
    // HIGH-D: Ignore masked sentinel values — frontend sends '*****' when the field
    // was not changed; treat it as "no update" so the real credential is preserved.
    if (dto.smtpPassword === '*****') delete dto.smtpPassword;
    if (dto.smartbillApiToken === '*****') delete dto.smartbillApiToken;

    // Capture previous values for diff (skip audit-redacted fields)
    const before = await settingsService.get();
    const raw = await settingsService.update(dto);

    // Invalidate caches immediately when settings change
    clearMaintenanceCache();
    clearAiToggleCache();
    clearAuditToggleCache();

    // Emit one audit event per changed field
    const actor = { userId: req.user?.id, email: req.user?.email };
    for (const key of Object.keys(dto) as Array<keyof typeof dto>) {
      const oldVal = (before as Record<string, unknown>)[key];
      const newVal = (dto as Record<string, unknown>)[key];
      // Normalize before comparing: Prisma Decimal fields come back as Decimal objects
      // whose .toString() is "21", while the DTO sends the plain number 21.
      if (String(oldVal ?? '') === String(newVal ?? '')) continue;
      if (SETTINGS_AUDIT_REDACT.has(key)) continue;

      const isToggleField = AUDIT_TOGGLE_FIELDS.has(key);
      await recordAuditEvent({
        category: AuditCategory.SETTINGS,
        action:   'SETTINGS_CHANGE',
        actor,
        // Audit toggle changes are WARN so they're always visible; treat others as INFO
        severity: isToggleField ? AuditSeverity.WARN : AuditSeverity.INFO,
        details:  { field: key, oldValue: oldVal, newValue: newVal },
      });
    }

    const { smtpPassword, smartbillApiToken, ...rest } = raw;
    const masked = {
      ...rest,
      smtpPassword: smtpPassword ? '*****' : '',
      smartbillApiToken: smartbillApiToken ? '*****' : '',
    };
    res.json({ success: true, data: masked });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    req.log.error({ err: error }, 'updateSettings failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const uploadLogo = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    // Validate actual file content via magic bytes (not just client-provided mimetype)
    const valid = await isValidImageFile(req.file.path);
    if (!valid) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ success: false, error: 'Invalid file content: not a recognised image format' });
      return;
    }

    // Store path relative to backend root (e.g. "uploads/logos/company-logo.png")
    const relativePath = path.join('uploads', 'logos', req.file.filename).replace(/\\/g, '/');
    const settings = await settingsService.updateLogoPath(relativePath);

    await recordAuditEvent({
      category: AuditCategory.SETTINGS,
      action:   'LOGO_UPLOAD',
      actor:    { userId: req.user?.id, email: req.user?.email },
      severity: AuditSeverity.INFO,
      details:  { path: relativePath },
    });

    res.json({ success: true, data: settings });
  } catch (error) {
    req.log.error({ err: error }, 'uploadLogo failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const testSmtpConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await settingsService.get();
    if (!settings.smtpHost || !settings.smtpEmail || !settings.smtpPassword) {
      res.status(400).json({ success: false, error: 'SMTP not configured' });
      return;
    }
    const port = settings.smtpPort || 587;
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port,
      secure: settings.smtpSecure,
      tls: { rejectUnauthorized: true },
      connectionTimeout: 10000,
      auth: { user: settings.smtpEmail, pass: settings.smtpPassword },
    });
    await transporter.verify();
    res.json({ success: true, data: { ok: true } });
  } catch (error) {
    req.log.error({ err: error }, 'testSmtpConnection failed');
    res.status(400).json({ success: false, error: extractSmtpError(error) });
  }
};

export const deleteLogo = async (req: Request, res: Response): Promise<void> => {
  try {
    const current = await settingsService.get();
    const previousPath = current.companyLogoPath;
    if (previousPath) {
      const absolutePath = path.join(BACKEND_ROOT, previousPath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }
    const settings = await settingsService.updateLogoPath(null);

    await recordAuditEvent({
      category: AuditCategory.SETTINGS,
      action:   'LOGO_DELETE',
      actor:    { userId: req.user?.id, email: req.user?.email },
      severity: AuditSeverity.WARN,
      details:  { previousPath },
    });

    res.json({ success: true, data: settings });
  } catch (error) {
    req.log.error({ err: error }, 'deleteLogo failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const uploadStamp = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    const valid = await isValidImageFile(req.file.path);
    if (!valid) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ success: false, error: 'Invalid file content: not a recognised image format' });
      return;
    }

    const relativePath = path.join('uploads', 'stamps', req.file.filename).replace(/\\/g, '/');
    const settings = await settingsService.updateStampPath(relativePath);

    await recordAuditEvent({
      category: AuditCategory.SETTINGS,
      action:   'STAMP_UPLOAD',
      actor:    { userId: req.user?.id, email: req.user?.email },
      severity: AuditSeverity.INFO,
      details:  { path: relativePath },
    });

    res.json({ success: true, data: settings });
  } catch (error) {
    req.log.error({ err: error }, 'uploadStamp failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const deleteStamp = async (req: Request, res: Response): Promise<void> => {
  try {
    const current = await settingsService.get();
    const previousPath = current.companyStampPath;
    if (previousPath) {
      const absolutePath = path.join(BACKEND_ROOT, previousPath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
      }
    }
    const settings = await settingsService.updateStampPath(null);

    await recordAuditEvent({
      category: AuditCategory.SETTINGS,
      action:   'STAMP_DELETE',
      actor:    { userId: req.user?.id, email: req.user?.email },
      severity: AuditSeverity.WARN,
      details:  { previousPath },
    });

    res.json({ success: true, data: settings });
  } catch (error) {
    req.log.error({ err: error }, 'deleteStamp failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getSystemInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    // Only system admin can access system info
    if (req.user?.email !== env.SEED_USER_EMAIL) {
      res.status(403).json({ success: false, error: 'System admin access required' });
      return;
    }

    const metrics = getMetricsSummary();
    const dbSizeResult = await prisma.$queryRaw<Array<{ size: bigint }>>`
      SELECT pg_database_size(current_database()) as size
    `;
    const settings = await settingsService.get();

    res.json({
      success: true,
      data: {
        nodeVersion: process.version,
        uptime: metrics.uptime,
        totalRequests: metrics.totalRequests,
        avgResponseTime: metrics.avgResponseTime,
        p95ResponseTime: metrics.p95ResponseTime,
        requestsPerMinute: metrics.requestsPerMinute,
        databaseSizeBytes: Number(dbSizeResult[0]?.size ?? 0),
        maintenanceEnabled: settings.maintenanceEnabled,
        environment: env.NODE_ENV,
      },
    });
  } catch (error) {
    req.log.error({ err: error }, 'getSystemInfo failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
