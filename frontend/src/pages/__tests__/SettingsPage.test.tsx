import React from 'react';
import { act, cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import SettingsPage from '@/pages/SettingsPage';
import { useAuthStore } from '@/store/auth.store';
import { createTestQueryClient } from '@/__tests__/helpers/query-client';

// ── Stable mock data created BEFORE vi.mock() factories run ─────────────────
// IMPORTANT: useSettings must return the SAME object reference on every render.
// If buildSettings() is called inside the mock factory, a new object is created
// on every call → useEffect([settings]) detects a changed reference every render
// → form.reset() → re-render → infinite loop → test hangs.

const { mockSettingsData, mockUpdateMutate } = vi.hoisted(() => {
  const mockUpdateMutate = vi.fn();
  const mockSettingsData = {
    id: 1,
    companyName: 'Test Company SRL',
    companyVatCode: 'RO12345678',
    companyRegNumber: 'J35/123/2020',
    companyAddress: 'Str. Test 1',
    companyCity: 'Timisoara',
    companyCounty: 'Timis',
    companyIban: '',
    companyBank: '',
    companySwift: '',
    companyLogoPath: null,
    companyPhone: '+40712345678',
    companyEmail: 'test@company.ro',
    termsAndConditions: '',
    smartbillEmail: '',
    smartbillApiToken: '',
    smartbillSeriesName: '',
    smartbillVatCode: '',
    defaultVatPercent: '19',
    defaultCurrency: 'EUR',
    defaultPaymentDays: 30,
    orderNumberStart: 1,
    smtpEmail: '',
    smtpPassword: '',
    smtpHost: '',
    smtpPort: 587,
    smtpEnabled: false,
    autoArchiveAfterMonths: 3,
    autoArchiveFrequency: 'DAILY',
    autoArchiveDay: null,
    autoArchiveTime: '02:00',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  return { mockSettingsData, mockUpdateMutate };
});

// ── Child component mocks ───────────────────────────────────────────────────

vi.mock('@/components/users/UsersManagementPanel', () => ({
  UsersManagementPanel: () => <div data-testid="users-panel">Users Panel</div>,
}));

vi.mock('@/components/security/SecurityTabContent', () => ({
  SecurityTabContent: () => <div data-testid="security-content">Security Content</div>,
}));

vi.mock('@/components/common/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}));

// PhoneInput uses react-phone-number-input which doesn't work in jsdom.
// Must use forwardRef because it is rendered inside Radix Slot (FormControl).
vi.mock('@/components/ui/phone-input', () => ({
  PhoneInput: React.forwardRef<HTMLInputElement, { value: string; onChange: (v: string) => void }>(
    ({ value, onChange }, ref) => (
      <input
        ref={ref}
        data-testid="phone-input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    ),
  ),
}));

// ── Hook mocks ──────────────────────────────────────────────────────────────
// Use plain arrow functions (not vi.fn()) so vi.clearAllMocks() doesn't wipe
// the hook implementations. Only mockUpdateMutate needs to be a vi.fn() so we
// can assert on it — it's managed via vi.hoisted() above.

vi.mock('@/hooks/useSettings', () => ({
  // Return the SAME stable object reference on every render (prevents useEffect loop)
  useSettings: () => ({ data: mockSettingsData, isLoading: false }),
  useUpdateSettings: () => ({ mutateAsync: mockUpdateMutate, isPending: false }),
  useUploadLogo: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteLogo: () => ({ mutate: vi.fn(), isPending: false }),
  useUploadStamp: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteStamp: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/components/settings/DeveloperSettingsPanel', () => ({
  DeveloperSettingsPanel: () => <div data-testid="developer-panel">Developer Panel</div>,
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

const initialAuthState = useAuthStore.getState();

async function renderPage() {
  const queryClient = createTestQueryClient();
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SettingsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  return result!;
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply implementations cleared by clearAllMocks
    mockUpdateMutate.mockResolvedValue(mockSettingsData);
    // Set ADMIN user so all 6 tabs are visible by default
    useAuthStore.setState({
      ...initialAuthState,
      token: 'test-token',
      user: { id: 1, email: 'admin@tms.ro', name: 'Admin', role: 'ADMIN', isSystemAdmin: false },
    });
  });

  afterEach(() => {
    // Unmount before resetting Zustand state — prevents act() warnings from
    // Zustand subscriber re-renders fired on a still-mounted SettingsPage.
    cleanup();
    useAuthStore.setState(initialAuthState);
  });

  it('renders all 6 tabs for an ADMIN user', async () => {
    await renderPage();

    expect(screen.getByRole('button', { name: /general/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /invoicing/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /security/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /users/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /database/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /system logs/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /integrations/i })).not.toBeInTheDocument();
  });

  it('Security and Users tabs render outside the Form wrapper (no Save button)', async () => {
    await renderPage();

    // Switch to Security tab — SecurityTabContent renders, Save Changes does NOT
    await userEvent.click(screen.getByRole('button', { name: /security/i }));
    expect(screen.getByTestId('security-content')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();

    // Switch to Users tab — UsersManagementPanel renders, Save Changes does NOT
    await userEvent.click(screen.getByRole('button', { name: /users/i }));
    expect(screen.getByTestId('users-panel')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
  });

  it('DISPATCHER role sees only Security tab (M40 RBAC)', async () => {
    useAuthStore.setState({
      ...initialAuthState,
      token: 'test-token',
      user: { id: 2, email: 'dispatcher@tms.ro', name: 'Dispatcher', role: 'DISPATCHER', isSystemAdmin: false },
    });

    await renderPage();

    // Only Security tab visible for DISPATCHER
    expect(screen.getByRole('button', { name: /security/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /general/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^users$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /database/i })).not.toBeInTheDocument();
  });

  it('Invoicing tab renders VAT and currency fields', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: /invoicing/i }));
    expect(screen.getByText(/default vat/i)).toBeInTheDocument();
    expect(screen.getByText(/default currency/i)).toBeInTheDocument();
  });

  it('General tab form calls updateSettings mutation on Save', async () => {
    const { container } = await renderPage();

    // Wait for useEffect to populate the form with mock settings
    await waitFor(() => {
      expect(screen.getByPlaceholderText('S.C. Example S.R.L.')).toHaveValue('Test Company SRL');
    });

    // Submit the form directly — more reliable than clicking the SaveButton component
    // (SaveButton is defined inside the parent component, causing remount on every render)
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => {
      expect(mockUpdateMutate).toHaveBeenCalledWith(
        expect.objectContaining({ companyName: 'Test Company SRL' }),
      );
    });
  });

  it('Developer tab is visible and renders DeveloperSettingsPanel for system admin', async () => {
    // Elevate to system admin — only then is the Developer tab shown
    useAuthStore.setState({
      ...initialAuthState,
      token: 'test-token',
      user: { id: 1, email: 'admin@tms.ro', name: 'Admin', role: 'ADMIN', isSystemAdmin: true },
    });

    await renderPage();

    // Developer tab button is present
    expect(screen.getByRole('button', { name: /developer/i })).toBeInTheDocument();

    // Click it
    await userEvent.click(screen.getByRole('button', { name: /developer/i }));

    // DeveloperSettingsPanel stub renders
    expect(screen.getByTestId('developer-panel')).toBeInTheDocument();
  });

  it('Developer tab is NOT visible for a regular ADMIN (non-system-admin)', async () => {
    // Default beforeEach sets isSystemAdmin: false
    await renderPage();
    expect(screen.queryByRole('button', { name: /developer/i })).not.toBeInTheDocument();
  });
});
