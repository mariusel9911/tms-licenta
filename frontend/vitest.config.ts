import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      passWithNoTests: true,
      setupFiles: ['./vitest.setup.ts'],
      include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov', 'html'],
        reportsDirectory: './coverage',
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          // shadcn/ui generated code — never modify, never test
          'src/components/ui/**',
          // Test helpers and infrastructure
          'src/**/__tests__/**',
          'src/vite-env.d.ts',
          // Bootstrap / route tree — tested by E2E
          'src/main.tsx',
          'src/App.tsx',
          // TypeScript interface-only files — no runtime code
          'src/types/**',
          // Complex form/modal components tested by 61 E2E tests (not in M16 unit-test scope)
          'src/components/orders/CharteringAgreementForm.tsx',
          'src/components/orders/OrderDetailPage.tsx',
          // OrderStatusSelect only used inside the excluded OrderDetailPage
          'src/components/orders/OrderStatusSelect.tsx',
          // TableSettingsModal / TableStatusPill: complex multi-select modal + inline Popover pill
          // for OrdersTable — covered by E2E orders tests
          'src/components/orders/TableSettingsModal.tsx',
          'src/components/orders/TableStatusPill.tsx',
          'src/components/partners/PartnerForm.tsx',
          'src/components/partners/QuickAddPartnerModal.tsx',
          'src/components/partners/ViesLookup.tsx',
          'src/components/vehicles/VehicleForm.tsx',
          'src/components/vehicles/QuickAddVehicleModal.tsx',
          'src/components/security/MfaSetupModal.tsx',
          'src/components/security/MfaDisableModal.tsx',
          // PasskeysList / SecurityTabContent: complex security UI components covered by settings.spec.ts E2E
          'src/components/security/PasskeysList.tsx',
          'src/components/security/SecurityTabContent.tsx',
          'src/components/users/UsersManagementPanel.tsx',
          // UserFormModal / ResetPasswordModal: complex multi-schema form modals tested by E2E
          'src/components/users/UserFormModal.tsx',
          'src/components/users/ResetPasswordModal.tsx',
          // Placeholder / future pages not yet implemented
          'src/pages/InvoicesPage.tsx',
          // shadcn-generated hook placed in src/hooks/ by the CLI (not ui/) — never modify
          'src/hooks/use-toast.ts',
          // Statistics page and data-visualisation components — Recharts charts are not
          // unit-testable; interactive parts (PredictionControls) have their own test file
          'src/pages/StatisticsPage.tsx',
          'src/components/statistics/RevenueChart.tsx',
          'src/components/statistics/RevenueLineChart.tsx',
          'src/components/statistics/MonthlyProfitTable.tsx',
          'src/components/statistics/ProfitPredictionChart.tsx',
          'src/components/statistics/StatusDistribution.tsx',
          'src/components/statistics/TopClientsChart.tsx',
          'src/components/statistics/StatsSummaryCards.tsx',
          // ChatWidget — complex chat UI component; covered by E2E tests
          'src/components/ai/ChatWidget.tsx',
          // Backup module (API + hook + UI components) — requires real pg_dump/psql/S3;
          // covered by E2E backup tests (M35)
          'src/api/backup.api.ts',
          'src/hooks/useBackup.ts',
          'src/components/settings/BackupManagementPanel.tsx',
          'src/components/settings/BackupProgressModal.tsx',
          // Audit log module — file streaming + gzip decompress + Radix dialogs; E2E tested
          'src/api/audit.api.ts',
          'src/hooks/useAuditLog.ts',
          'src/components/settings/SystemLogsPanel.tsx',
          // Infrastructure hooks — not suitable for unit tests in jsdom
          // usePrefetchRoutes: uses requestIdleCallback + dynamic imports (no testable output)
          // useReducedMotion: wraps window.matchMedia MediaQuery API
          'src/hooks/usePrefetchRoutes.ts',
          'src/hooks/useReducedMotion.ts',
          // VehicleFinanceCard — large Recharts chart component in statistics; same exclusion policy
          // as other statistics charts (no unit-testable Recharts output in jsdom)
          'src/components/statistics/VehicleFinanceCard.tsx',
          // EmailOtpDisableModal / PasskeySetupModal — complex security modals; same policy as
          // MfaDisableModal / PasskeysList (covered by settings.spec.ts E2E tests)
          'src/components/security/EmailOtpDisableModal.tsx',
          'src/components/security/PasskeySetupModal.tsx',
          // ErrorBoundary — class-based React component; requires throwing errors inside React tree
          // which is fragile in jsdom; the render path is covered by E2E tests
          'src/components/ErrorBoundary.tsx',
        ],
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 70,
          statements: 80,
        },
      },
      css: false,
    },
  }),
);
