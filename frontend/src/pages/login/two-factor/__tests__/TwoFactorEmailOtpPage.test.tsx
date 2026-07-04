import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TwoFactorEmailOtpPage from '@/pages/login/two-factor/TwoFactorEmailOtpPage';
import { useAuthStore } from '@/store/auth.store';
import { requestEmailOtpApi, verifyMfaApi } from '@/api/auth.api';

// ── UI mocks (no animation support in jsdom) ──────────────────────────────

vi.mock('@/components/ui/background-paths', () => ({
  FloatingPaths: () => null,
}));

vi.mock('@/components/ui/animated-theme-toggle', () => ({
  AnimatedThemeToggle: () => null,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      className,
    }: {
      children: React.ReactNode;
      className?: string;
    }) => <div className={className}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── InputOTP mock — renders a simple controlled input ──────────────────────

vi.mock('@/components/ui/input-otp', () => ({
  InputOTP: ({
    value,
    onChange,
    onComplete,
    disabled,
    maxLength,
  }: {
    value: string;
    onChange: (val: string) => void;
    onComplete: (val: string) => void;
    disabled?: boolean;
    maxLength: number;
  }) => (
    <input
      data-testid="otp-input"
      value={value}
      disabled={disabled}
      maxLength={maxLength}
      onChange={(e) => {
        onChange(e.target.value);
        if (e.target.value.length === maxLength) {
          onComplete(e.target.value);
        }
      }}
    />
  ),
  InputOTPGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  InputOTPSlot: () => null,
  InputOTPSeparator: () => null,
}));

// ── API mocks ─────────────────────────────────────────────────────────────

vi.mock('@/api/auth.api', () => ({
  requestEmailOtpApi: vi.fn(),
  verifyMfaApi: vi.fn(),
}));

// ── Router mock ───────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── Helpers ───────────────────────────────────────────────────────────────

const initialAuthState = useAuthStore.getState();

function renderPage() {
  return render(
    <MemoryRouter>
      <TwoFactorEmailOtpPage />
    </MemoryRouter>,
  );
}

describe('TwoFactorEmailOtpPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState(initialAuthState);
  });

  it('redirects to /login (renders nothing) when mfaPendingToken is null', () => {
    useAuthStore.setState({ mfaPendingToken: null, mfaMethods: null, mfaMaskedEmail: null });
    renderPage();

    // <Navigate> renders null — the page title should not be visible
    expect(screen.queryByText('Email verification')).not.toBeInTheDocument();
  });

  it('shows OTP input after clicking Send code', async () => {
    useAuthStore.setState({
      mfaPendingToken: 'mfa-token-abc',
      mfaMethods: ['totp', 'recovery_code', 'email_otp'],
      mfaMaskedEmail: 't***@tms.ro',
    });
    vi.mocked(requestEmailOtpApi).mockResolvedValue({
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    });

    renderPage();

    expect(screen.getByText(/We'll send a 6-digit code to t\*\*\*@tms\.ro/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));

    await waitFor(() => {
      expect(requestEmailOtpApi).toHaveBeenCalledWith('mfa-token-abc');
      expect(screen.getByText(/Code sent/)).toBeInTheDocument();
      expect(screen.getByTestId('otp-input')).toBeInTheDocument();
    });
  });

  it('calls verifyMfaApi with emailOtpCode and navigates to /orders on success', async () => {
    useAuthStore.setState({
      mfaPendingToken: 'mfa-token-abc',
      mfaMethods: ['totp', 'recovery_code', 'email_otp'],
      mfaMaskedEmail: null,
    });
    vi.mocked(requestEmailOtpApi).mockResolvedValue({
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    vi.mocked(verifyMfaApi).mockResolvedValue({
      token: 'full-jwt',
      user: { id: 1, email: 'test@tms.ro', name: 'Test', role: 'ADMIN', isSystemAdmin: false },
    });

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await waitFor(() => expect(screen.getByTestId('otp-input')).toBeInTheDocument());

    // Trigger OTP input with 6-digit code via fireEvent to bypass userEvent timing issues
    fireEvent.change(screen.getByTestId('otp-input'), { target: { value: '123456' } });

    await waitFor(() => {
      expect(verifyMfaApi).toHaveBeenCalledWith('mfa-token-abc', { emailOtpCode: '123456' });
      expect(mockNavigate).toHaveBeenCalledWith('/orders', { replace: true });
    });
  });

  it('shows resend cooldown immediately after code is sent', async () => {
    useAuthStore.setState({
      mfaPendingToken: 'mfa-token-abc',
      mfaMethods: ['totp', 'recovery_code', 'email_otp'],
      mfaMaskedEmail: null,
    });
    vi.mocked(requestEmailOtpApi).mockResolvedValue({
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    });

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));

    await waitFor(() => {
      // Cooldown starts at 60s immediately after send
      expect(screen.getByText(/Resend code in \d+s/)).toBeInTheDocument();
    });
  });

  it('"More options" collapsible shows passkey, TOTP, and recovery alternatives', async () => {
    useAuthStore.setState({
      mfaPendingToken: 'mfa-token-abc',
      mfaMethods: ['passkey', 'totp', 'recovery_code', 'email_otp'],
      mfaMaskedEmail: null,
    });

    renderPage();

    // Toggle "More options"
    await userEvent.click(screen.getByRole('button', { name: /More options/i }));

    expect(screen.getByRole('button', { name: 'Passkey' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Authenticator app' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recovery code' })).toBeInTheDocument();
  });

  it('shows mfa_token_invalid error when handleSendCode fails with that code', async () => {
    useAuthStore.setState({
      mfaPendingToken: 'mfa-token-abc',
      mfaMethods: ['email_otp'],
      mfaMaskedEmail: null,
    });
    vi.mocked(requestEmailOtpApi).mockRejectedValue(new Error('mfa_token_invalid'));

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));

    await waitFor(() => {
      expect(screen.getByText('Session expired. Please go back and sign in again.')).toBeInTheDocument();
    });
  });

  it('shows smtp_not_configured error when SMTP is not set up', async () => {
    useAuthStore.setState({
      mfaPendingToken: 'mfa-token-abc',
      mfaMethods: ['email_otp'],
      mfaMaskedEmail: null,
    });
    vi.mocked(requestEmailOtpApi).mockRejectedValue(new Error('smtp_not_configured'));

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));

    await waitFor(() => {
      expect(screen.getByText('Email is not configured. Please contact your administrator.')).toBeInTheDocument();
    });
  });

  it('shows generic error when send fails for unknown reason', async () => {
    useAuthStore.setState({
      mfaPendingToken: 'mfa-token-abc',
      mfaMethods: ['email_otp'],
      mfaMaskedEmail: null,
    });
    vi.mocked(requestEmailOtpApi).mockRejectedValue(new Error('network_error'));

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));

    await waitFor(() => {
      expect(screen.getByText('Failed to send code. Please try again.')).toBeInTheDocument();
    });
  });

  it('shows email_otp_invalid error when verifyMfaApi throws that code', async () => {
    useAuthStore.setState({
      mfaPendingToken: 'mfa-token-abc',
      mfaMethods: ['email_otp'],
      mfaMaskedEmail: null,
    });
    vi.mocked(requestEmailOtpApi).mockResolvedValue({
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    });
    vi.mocked(verifyMfaApi).mockRejectedValue(new Error('email_otp_invalid'));

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await waitFor(() => expect(screen.getByTestId('otp-input')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('otp-input'), { target: { value: '000000' } });

    await waitFor(() => {
      expect(screen.getByText('Invalid or expired code. Please try again.')).toBeInTheDocument();
    });
  });

  it('navigates to /login/two-factor/webauthn when clicking Passkey in More options', async () => {
    useAuthStore.setState({
      mfaPendingToken: 'mfa-token-abc',
      mfaMethods: ['passkey', 'totp', 'recovery_code', 'email_otp'],
      mfaMaskedEmail: null,
    });

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Passkey' }));

    expect(mockNavigate).toHaveBeenCalledWith('/login/two-factor/webauthn', { replace: true });
  });

  it('navigates to /login/two-factor/totp when clicking Authenticator app in More options', async () => {
    useAuthStore.setState({
      mfaPendingToken: 'mfa-token-abc',
      mfaMethods: ['totp', 'email_otp'],
      mfaMaskedEmail: null,
    });

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.click(screen.getByRole('button', { name: /authenticator app/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/login/two-factor/totp', { replace: true });
  });

  it('navigates to /login/two-factor/recovery when clicking Recovery code in More options', async () => {
    useAuthStore.setState({
      mfaPendingToken: 'mfa-token-abc',
      mfaMethods: ['recovery_code', 'email_otp'],
      mfaMaskedEmail: null,
    });

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.click(screen.getByRole('button', { name: /recovery code/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/login/two-factor/recovery', { replace: true });
  });

  it('Back button clears MFA state and navigates to /login', async () => {
    useAuthStore.setState({
      mfaPendingToken: 'mfa-token-abc',
      mfaMethods: ['email_otp'],
      mfaMaskedEmail: null,
    });

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /back to sign in/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    expect(useAuthStore.getState().mfaPendingToken).toBeNull();
  });
});
