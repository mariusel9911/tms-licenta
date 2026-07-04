import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { PrivateRoute } from '@/components/PrivateRoute';
import LoginPage from '@/pages/login/LoginPage';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Lazy-load AppLayout (imports Sidebar + Header + framer-motion — not needed on /login)
const AppLayout = lazy(() =>
  import('@/components/layout/AppLayout').then(m => ({ default: m.AppLayout }))
);

// Lazy-load 2FA pages (only visited after login step 1)
const TwoFactorWebAuthnPage = lazy(() => import('@/pages/login/two-factor/TwoFactorWebAuthnPage'));
const TwoFactorTotpPage = lazy(() => import('@/pages/login/two-factor/TwoFactorTotpPage'));
const TwoFactorRecoveryPage = lazy(() => import('@/pages/login/two-factor/TwoFactorRecoveryPage'));
const TwoFactorEmailOtpPage = lazy(() => import('@/pages/login/two-factor/TwoFactorEmailOtpPage'));

// Lazy-load protected pages (Orders/Partners/Vehicles are eagerly rendered in AppLayout)
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const StatisticsPage = lazy(() => import('@/pages/StatisticsPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const MaintenancePage = lazy(() => import('@/pages/MaintenancePage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60, // 1 minute
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/maintenance" element={<MaintenancePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/login/two-factor/webauthn" element={<TwoFactorWebAuthnPage />} />
              <Route path="/login/two-factor/totp" element={<TwoFactorTotpPage />} />
              <Route path="/login/two-factor/recovery" element={<TwoFactorRecoveryPage />} />
              <Route path="/login/two-factor/email-otp" element={<TwoFactorEmailOtpPage />} />
              <Route element={<PrivateRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Navigate to="/orders" replace />} />
                  {/* /orders, /partners, /vehicles — always rendered in AppLayout; empty routes keep URL matching + NavLink active state */}
                  <Route path="/orders" />
                  <Route path="/partners" />
                  <Route path="/vehicles" />
                  {/* <Route path="/invoices" element={<InvoicesPage />} /> TODO: Coming soon */}
                  <Route path="/statistics" element={<StatisticsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}
