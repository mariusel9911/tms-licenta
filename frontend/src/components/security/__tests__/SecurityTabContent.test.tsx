import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { SecurityTabContent } from '@/components/security/SecurityTabContent';
import { createTestQueryClient } from '@/__tests__/helpers/query-client';

// Mock hooks
const mockUseMfaStatus = vi.fn();
const mockUseRecoveryCodeCount = vi.fn();
const mockUseRegenerateRecoveryCodes = vi.fn();
const mockUsePasskeys = vi.fn();
const mockUseSettings = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useMfaStatus: () => mockUseMfaStatus(),
  useRecoveryCodeCount: () => mockUseRecoveryCodeCount(),
  useRegenerateRecoveryCodes: () => mockUseRegenerateRecoveryCodes(),
  usePasskeys: () => mockUsePasskeys(),
  useRemovePasskey: () => ({ mutate: vi.fn(), isPending: false }),
  useRenamePasskey: () => ({ mutate: vi.fn(), isPending: false }),
  useToggleEmailOtp: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => mockUseSettings(),
}));

// Mock child modals — test their opening, not their internals
vi.mock('@/components/security/MfaSetupModal', () => ({
  MfaSetupModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="mfa-setup-modal">MFA Setup Modal</div> : null,
}));

vi.mock('@/components/security/MfaDisableModal', () => ({
  MfaDisableModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="mfa-disable-modal">MFA Disable Modal</div> : null,
}));

vi.mock('@/components/security/RecoveryCodesModal', () => ({
  RecoveryCodesModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="recovery-codes-modal">Recovery Codes Modal</div> : null,
}));

vi.mock('@/components/security/PasskeysList', () => ({
  PasskeysList: () => <div data-testid="passkeys-list">Passkeys List</div>,
}));

vi.mock('@/components/security/PasskeySetupModal', () => ({
  PasskeySetupModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="passkey-setup-modal">Passkey Setup Modal</div> : null,
}));

function renderContent() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <SecurityTabContent />
    </QueryClientProvider>,
  );
}

describe('SecurityTabContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no recovery codes data, no pending mutation, no passkeys, SMTP not configured
    mockUseRecoveryCodeCount.mockReturnValue({ data: undefined });
    mockUseRegenerateRecoveryCodes.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mockUsePasskeys.mockReturnValue({ data: [], isLoading: false });
    mockUseSettings.mockReturnValue({ data: { smtpEnabled: false, smtpHost: '', smtpEmail: '' } });
  });

  it('shows TOTP toggle switch as unchecked when MFA is not enabled', () => {
    mockUseMfaStatus.mockReturnValue({ data: { totpEnabled: false }, isLoading: false });
    renderContent();

    expect(screen.getByText('Mobile Authenticator App')).toBeInTheDocument();
    // Toggle switch renders with role="switch"; when disabled it has aria-checked="false"
    const switches = screen.getAllByRole('switch');
    expect(switches[0]).toHaveAttribute('aria-checked', 'false');
  });

  it('shows TOTP toggle switch as checked when MFA is enabled', () => {
    mockUseMfaStatus.mockReturnValue({ data: { totpEnabled: true }, isLoading: false });
    renderContent();

    const switches = screen.getAllByRole('switch');
    expect(switches[0]).toHaveAttribute('aria-checked', 'true');
  });

  it('opens MfaSetupModal when TOTP switch is clicked (OFF → ON)', async () => {
    mockUseMfaStatus.mockReturnValue({ data: { totpEnabled: false }, isLoading: false });
    renderContent();

    // Click the TOTP toggle (aria-checked=false → triggers setup flow)
    const totpSwitch = screen.getAllByRole('switch')[0];
    await userEvent.click(totpSwitch);

    expect(screen.getByTestId('mfa-setup-modal')).toBeInTheDocument();
  });

  it('opens MfaDisableModal when TOTP switch is clicked (ON → OFF)', async () => {
    mockUseMfaStatus.mockReturnValue({ data: { totpEnabled: true }, isLoading: false });
    renderContent();

    // Click the TOTP toggle (aria-checked=true → triggers disable flow)
    const totpSwitch = screen.getAllByRole('switch')[0];
    await userEvent.click(totpSwitch);

    expect(screen.getByTestId('mfa-disable-modal')).toBeInTheDocument();
  });

  it('shows a loading placeholder when status is loading', () => {
    mockUseMfaStatus.mockReturnValue({ data: undefined, isLoading: true });
    renderContent();

    // Loading state renders an animated placeholder div, not Enable/Disable buttons
    expect(screen.queryByRole('button', { name: 'Enable' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument();
  });

  it('shows recovery code count when MFA is enabled', () => {
    mockUseMfaStatus.mockReturnValue({ data: { totpEnabled: true }, isLoading: false });
    mockUseRecoveryCodeCount.mockReturnValue({ data: { remaining: 8 } });
    renderContent();

    expect(screen.getByText('8 recovery codes remaining')).toBeInTheDocument();
  });

  it('shows amber warning badge when remaining codes are 2 or fewer', () => {
    mockUseMfaStatus.mockReturnValue({ data: { totpEnabled: true }, isLoading: false });
    mockUseRecoveryCodeCount.mockReturnValue({ data: { remaining: 2 } });
    renderContent();

    expect(screen.getByText('Low — regenerate soon')).toBeInTheDocument();
  });

  it('renders Passkeys section with correct heading', () => {
    mockUseMfaStatus.mockReturnValue({ data: { totpEnabled: false }, isLoading: false });
    renderContent();

    expect(screen.getByText('Passkeys / Security Keys')).toBeInTheDocument();
    expect(screen.getByTestId('passkeys-list')).toBeInTheDocument();
  });

  it('opens PasskeySetupModal when Register Passkey button is clicked', async () => {
    mockUseMfaStatus.mockReturnValue({ data: { totpEnabled: false }, isLoading: false });
    renderContent();

    await userEvent.click(screen.getByRole('button', { name: 'Register Passkey' }));

    expect(screen.getByTestId('passkey-setup-modal')).toBeInTheDocument();
  });

  it('shows Email OTP toggle switch when SMTP is configured', () => {
    mockUseMfaStatus.mockReturnValue({ data: { totpEnabled: false, emailOtpEnabled: false }, isLoading: false });
    mockUseSettings.mockReturnValue({
      data: { smtpEnabled: true, smtpHost: 'smtp.example.com', smtpEmail: 'noreply@example.com' },
    });
    renderContent();

    expect(screen.getByText('Email OTP')).toBeInTheDocument();
    // Both TOTP and Email OTP render toggle switches when SMTP is configured
    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(2);
    expect(switches[1]).toHaveAttribute('aria-checked', 'false');
  });

  it('shows "SMTP not configured" when SMTP is not configured', () => {
    mockUseMfaStatus.mockReturnValue({ data: { totpEnabled: false }, isLoading: false });
    mockUseSettings.mockReturnValue({ data: { smtpEnabled: false, smtpHost: '', smtpEmail: '' } });
    renderContent();

    expect(screen.getByText('Email OTP')).toBeInTheDocument();
    expect(screen.getByText('SMTP not configured')).toBeInTheDocument();
  });
});
