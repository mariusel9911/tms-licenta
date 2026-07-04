import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    passWithNoTests: true,
    include: ['src/**/__tests__/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      clean: true,
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: [
        'src/modules/**/*.ts',
        'src/utils/**/*.ts',
        'src/config/**/*.ts',
        'src/middleware/**/*.ts',
      ],
      exclude: [
        'src/**/__tests__/**',
        'src/config/database.ts',
        'src/config/paths.ts',
        'src/middleware/logger.middleware.ts',
        // Dead code — old findFirst-based order-number generator superseded by
        // src/modules/orders/order-number.util.ts (which has 100% coverage).
        'src/utils/order-number.util.ts',
        // SmartBill integration — on hold, no tests yet.
        'src/config/smartbill.ts',
        // Multer config — disk storage callbacks are not unit-testable without disk.
        'src/middleware/upload.middleware.ts',
        // Mailer service — sends real emails via SMTP; side-effectful, covered by integration/E2E.
        'src/config/mailer.service.ts',
        // Image validator — reads file magic bytes from disk; requires real files on disk.
        'src/utils/image-validator.ts',
        // WebAuthn controller — requires @simplewebauthn/server browser-API mocks;
        // authentication flow is covered by E2E tests.
        'src/modules/auth/webauthn.controller.ts',
        // Backup module — requires real pg_dump/psql processes + S3 API calls;
        // infrastructure-level operations not suitable for unit tests; covered by E2E backup tests (M35).
        'src/modules/backup/backup.service.ts',
        'src/modules/backup/backup.controller.ts',
        'src/modules/backup/backup.router.ts',
        // Health check — makes real network calls to DB + Ollama + Python API (3s timeout each);
        // cannot be unit-tested without mocking all three external services simultaneously.
        'src/config/health.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
    deps: {
      interopDefault: true,
    },
  },
  resolve: {
    alias: {},
  },
});
