import path from 'path';

// Use process.cwd() so this resolves correctly in both environments:
//   dev  (ts-node-dev from backend/):  cwd = D:\TMS_APP\backend
//   prod (Docker WORKDIR /app):        cwd = /app
// Previously used path.resolve(__dirname, '..', '..'), which was correct for
// development (src/config → backend/) but resolved to /app/dist in production
// because tsconfig.build.json sets rootDir:"." which compiles to dist/src/config/.
export const BACKEND_ROOT = process.cwd();

// All user-uploaded files live here
export const UPLOADS_DIR = path.join(BACKEND_ROOT, 'uploads');
export const LOGOS_DIR = path.join(UPLOADS_DIR, 'logos');
export const STAMPS_DIR = path.join(UPLOADS_DIR, 'stamps');
export const BACKUPS_DIR = path.join(BACKEND_ROOT, 'backups');

// System audit log (append-only JSONL, rotated daily, gitignored)
export const LOGS_DIR = path.join(BACKEND_ROOT, 'logs');
export const AUDIT_LOG_DIR = path.join(LOGS_DIR, 'audit');
