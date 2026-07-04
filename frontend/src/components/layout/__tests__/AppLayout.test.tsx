import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuthStore } from '@/store/auth.store';

vi.mock('@/components/layout/Sidebar', () => ({
  Sidebar: () => <aside data-testid="sidebar" />,
}));

vi.mock('@/components/layout/Header', () => ({
  Header: () => <header data-testid="app-header" />,
}));

// AppLayout now always mounts these three pages — mock them to avoid QueryClient dependency
vi.mock('@/pages/OrdersPage', () => ({ default: () => <div data-testid="orders-page" /> }));
vi.mock('@/pages/PartnersPage', () => ({ default: () => <div data-testid="partners-page" /> }));
vi.mock('@/pages/VehiclesPage', () => ({ default: () => <div data-testid="vehicles-page" /> }));

vi.mock('@/components/ai/ChatWidget', () => ({
  ChatWidget: () => <div data-testid="chat-widget" />,
}));

// ── Hoisted mock fns ──────────────────────────────────────────────────────────
const { mockUseSettings, mockUseMaintenanceStatus } = vi.hoisted(() => ({
  mockUseSettings: vi.fn(),
  mockUseMaintenanceStatus: vi.fn(),
}));

vi.mock('@/hooks/useSettings', () => ({
  useSettings: mockUseSettings,
  useMaintenanceStatus: mockUseMaintenanceStatus,
}));

vi.mock('@/hooks/usePrefetchRoutes', () => ({
  usePrefetchRoutes: vi.fn(),
}));

vi.mock('@/store/auth.store', () => ({
  useAuthStore: vi.fn((selector) => selector({ user: { isSystemAdmin: false } })),
}));

function renderLayout() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<div data-testid="child-content">Child</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseMaintenanceStatus.mockReturnValue({ data: { enabled: false } });
});

describe('AppLayout', () => {
  it('renders sidebar, header, and outlet content', () => {
    mockUseSettings.mockReturnValue({ data: { aiChatbotEnabled: true } });
    renderLayout();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('app-header')).toBeInTheDocument();
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('renders ChatWidget when aiChatbotEnabled is true', async () => {
    mockUseSettings.mockReturnValue({ data: { aiChatbotEnabled: true } });
    renderLayout();
    expect(await screen.findByTestId('chat-widget')).toBeInTheDocument();
  });

  it('does NOT render ChatWidget when aiChatbotEnabled is false', () => {
    mockUseSettings.mockReturnValue({ data: { aiChatbotEnabled: false } });
    renderLayout();
    expect(screen.queryByTestId('chat-widget')).not.toBeInTheDocument();
  });

  it('renders ChatWidget when settings are still loading (data: undefined)', async () => {
    mockUseSettings.mockReturnValue({ data: undefined });
    renderLayout();
    expect(await screen.findByTestId('chat-widget')).toBeInTheDocument();
  });

  it('redirects non-sysadmin to /maintenance when maintenance is enabled', () => {
    mockUseSettings.mockReturnValue({ data: { aiChatbotEnabled: false } });
    mockUseMaintenanceStatus.mockReturnValue({ data: { enabled: true } });
    const locations: string[] = [];
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<div data-testid="child-content">Child</div>} />
          </Route>
          <Route path="/maintenance" element={<div data-testid="maintenance-page" />} />
        </Routes>
      </MemoryRouter>,
    );
    void locations;
    expect(screen.getByTestId('maintenance-page')).toBeInTheDocument();
  });

  it('does NOT redirect sysadmin when maintenance is enabled', () => {
    vi.mocked(useAuthStore).mockImplementation((selector) =>
      selector({ user: { isSystemAdmin: true } } as Parameters<typeof selector>[0]),
    );
    mockUseSettings.mockReturnValue({ data: { aiChatbotEnabled: false } });
    mockUseMaintenanceStatus.mockReturnValue({ data: { enabled: true } });
    renderLayout();
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });
});
