import { lazy, Suspense, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { usePrefetchRoutes } from '@/hooks/usePrefetchRoutes';
import { useSettings, useMaintenanceStatus } from '@/hooks/useSettings';
import { useAuthStore } from '@/store/auth.store';
import OrdersPage from '@/pages/OrdersPage';
import PartnersPage from '@/pages/PartnersPage';
import VehiclesPage from '@/pages/VehiclesPage';

const ChatWidget = lazy(() =>
  import('@/components/ai/ChatWidget').then(m => ({ default: m.ChatWidget }))
);

// Pages whose state must survive sidebar navigation — always mounted, CSS-hidden when inactive.
const TRANSACTIONAL_PATHS = ['/orders', '/partners', '/vehicles'];

export function AppLayout() {
  // Prefetch all other lazy-loaded page chunks during idle time
  usePrefetchRoutes();

  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: settings } = useSettings();
  const isSystemAdmin = useAuthStore((s) => s.user?.isSystemAdmin === true);

  // Poll maintenance status every 30s — redirect non-sysadmin users when toggled ON
  const { data: maintenanceData } = useMaintenanceStatus();
  useEffect(() => {
    if (maintenanceData?.enabled && !isSystemAdmin) {
      navigate('/maintenance', { replace: true });
    }
  }, [maintenanceData, isSystemAdmin, navigate]);
  // Default to showing while settings are loading to avoid flash-of-missing-widget
  const chatbotEnabled = settings?.aiChatbotEnabled !== false;

  const isTransactional = TRANSACTIONAL_PATHS.some(p => pathname.startsWith(p));

  return (
    <div className="flex h-screen overflow-hidden bg-[#f0f2f5]">
      <Sidebar />
      {/* min-w-0 prevents flex blowout on wide tables */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header />
        {/* min-h-0 prevents flex item from growing beyond parent height (avoids body-level scroll) */}
        <main className="flex-1 overflow-y-auto p-6 min-h-0">
          {/* Always-mounted transactional pages — CSS-hidden when inactive so tab/form state survives navigation */}
          <div className={pathname.startsWith('/orders') ? '' : 'hidden'}><OrdersPage /></div>
          <div className={pathname.startsWith('/partners') ? '' : 'hidden'}><PartnersPage /></div>
          <div className={pathname.startsWith('/vehicles') ? '' : 'hidden'}><VehiclesPage /></div>
          {/* All other pages (Statistics, Settings, …) rendered via React Router outlet */}
          {!isTransactional && <Outlet />}
        </main>
      </div>
      {chatbotEnabled && (
        <Suspense fallback={null}>
          <ChatWidget />
        </Suspense>
      )}
    </div>
  );
}