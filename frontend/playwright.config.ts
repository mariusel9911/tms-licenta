import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for TMS E2E tests.
 * Frontend: http://localhost:5173 (Vite dev server)
 * Backend:  http://localhost:3001 (Express API)
 *
 * Assumes both servers are already running before tests execute.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',

  /* Maximum time one test can run */
  timeout: 30_000,

  /* Expect timeout for assertions */
  expect: {
    timeout: 8_000,
  },

  /* Run tests in files in parallel */
  fullyParallel: false,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Number of workers — keep low to avoid race conditions on shared state */
  workers: 1,

  /* Reporter: HTML report + list output to terminal */
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'playwright-report/junit.xml' }],
    ['list'],
  ],

  /* Shared settings for all projects */
  use: {
    baseURL: 'http://localhost:5173',

    /* Collect trace only on first retry — keeps artifacts small */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* No video by default; enable on failure if needed */
    video: 'retain-on-failure',

    /* Viewport */
    viewport: { width: 1280, height: 800 },

    /* Navigation timeout */
    navigationTimeout: 15_000,

    /* Action timeout */
    actionTimeout: 8_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Output directory for test artifacts */
  outputDir: 'tests/e2e/artifacts',
});
