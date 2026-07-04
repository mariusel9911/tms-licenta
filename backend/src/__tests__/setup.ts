/**
 * Global test setup — runs before every test file.
 * MUST set process.env vars BEFORE any module that imports env.ts is loaded.
 * env.ts calls dotenv.config() at module level, which only sets vars not already in process.env.
 */

// Set required env vars before any imports trigger env.ts validation
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/tms_test';
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
process.env.JWT_EXPIRES_IN = '1h';
process.env.PORT = '3001';
process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.SEED_USER_EMAIL = 'admin@tms.ro';
process.env.LOG_LEVEL = 'silent';

// Prevent maintenance middleware from hitting the real DB during tests.
// Without this, controller tests that import `app` trigger prisma.appSettings.findUnique()
// on the first request because cacheExpiry starts at 0.
vi.mock('../middleware/maintenance.middleware', () => ({
  maintenanceMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
  clearMaintenanceCache: vi.fn(),
  isMaintenanceActive: vi.fn().mockResolvedValue(false),
}));
