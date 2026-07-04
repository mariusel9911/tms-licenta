import path from 'path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { prisma } from './config/database.js';
import { UPLOADS_DIR } from './config/paths.js';
import { checkHealth } from './config/health.js';
import { httpLogger } from './middleware/logger.middleware.js';
import { errorMiddleware } from './middleware/error.middleware.js';
import { metricsMiddleware, getMetricsSummary } from './middleware/metrics.middleware.js';
import { authMiddleware } from './middleware/auth.middleware.js';
import { authRouter } from './modules/auth/auth.router.js';
import { partnersRouter } from './modules/partners/partners.router.js';
import { vehiclesRouter } from './modules/vehicles/vehicles.router.js';
import { ordersRouter } from './modules/orders/orders.router.js';
import { activityRouter } from './modules/activity/activity.router.js';
import { settingsRouter } from './modules/settings/settings.router.js';
import { usersRouter } from './modules/users/users.router.js';
import { backupRouter } from './modules/backup/backup.router.js';
import { auditRouter } from './modules/audit/audit.router.js';
import aiRouter from './modules/ai/ai.router.js';
import { requireAdmin } from './middleware/role.middleware.js';
import { apiLimiter } from './middleware/rate-limit.middleware.js';
import { maintenanceMiddleware } from './middleware/maintenance.middleware.js';

export const app = express();
app.set('trust proxy', 1);

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        imgSrc:     ["'self'"],
        connectSrc: ["'self'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
    permittedCrossDomainPolicies: false,
  }),
);
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(httpLogger);
app.use(metricsMiddleware);

// ─── Static Files (uploaded assets — no auth required) ───────────────────────
app.use('/api/uploads', express.static(path.join(UPLOADS_DIR)));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  const { httpStatus, body } = await checkHealth();
  res.status(httpStatus).json({ success: httpStatus === 200, data: body });
});

// ─── Metrics (admin only) ────────────────────────────────────────────────────
app.get('/api/metrics', authMiddleware, requireAdmin, (_req, res) => {
  res.json({ success: true, data: getMetricsSummary() });
});

// ─── Maintenance Status (public — no auth) ──────────────────────────────────
app.get('/api/maintenance/status', async (_req, res) => {
  const settings = await prisma.appSettings.findUnique({
    where: { id: 1 },
    select: { maintenanceEnabled: true, maintenanceMessage: true },
  });
  res.json({
    success: true,
    data: {
      enabled: settings?.maintenanceEnabled ?? false,
      message: settings?.maintenanceMessage ?? '',
    },
  });
});

// ─── Module Routes ────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/partners', authMiddleware, maintenanceMiddleware, apiLimiter, partnersRouter);
app.use('/api/vehicles', authMiddleware, maintenanceMiddleware, apiLimiter, vehiclesRouter);
app.use('/api/orders', authMiddleware, maintenanceMiddleware, apiLimiter, ordersRouter);
// Activity nested under orders — must come AFTER /api/orders mount
app.use('/api/orders/:orderId/activity', authMiddleware, maintenanceMiddleware, apiLimiter, activityRouter);
app.use('/api/settings', authMiddleware, maintenanceMiddleware, apiLimiter, settingsRouter);
app.use('/api/users', authMiddleware, maintenanceMiddleware, requireAdmin, apiLimiter, usersRouter);
app.use('/api/backup', authMiddleware, maintenanceMiddleware, requireAdmin, apiLimiter, backupRouter);
app.use('/api/audit',  authMiddleware, maintenanceMiddleware, requireAdmin, apiLimiter, auditRouter);
app.use('/api/ai', authMiddleware, maintenanceMiddleware, apiLimiter, aiRouter);

// ─── Global Error Handler (must be last) ─────────────────────────────────────
app.use(errorMiddleware);
