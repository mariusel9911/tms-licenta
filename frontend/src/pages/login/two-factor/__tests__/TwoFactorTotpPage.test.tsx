import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TwoFactorTotpPage from '@/pages/login/two-factor/TwoFactorTotpPage';
import { useAuthStore } from '@/store/auth.store';
import { verifyMfaApi } from '@/api/auth.api';

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

// ── InputOTP mock — renders a simple controlled input ─────────────────────

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
const testUser = { id: 1, email: 'user@tms.ro', name: 'User', role: 'ADMIN' as const, isSystemAdmin: false };

function renderPage() {
  return render(
    <MemoryRouter>
      <TwoFactorTotpPage />
    </MemoryRouter>,
  );
}

function setMfaPending(methods = ['totp', 'recovery_code']) {
  useAuthStore.setState({
    ...initialAuthState,
    mfaPendingToken: 'mfa-token-123',
    mfaMethods: methods,
    mfaMaskedEmail: null,
  });
}

describe('TwoFactorTotpPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState(initialAuthState);
  });

  it('redirects to /login when mfaPendingToken is null', () => {
    useAuthStore.setState({ mfaPendingToken: null, mfaMethods: null });
    renderPage();
    expect(screen.queryByText('Two-factor authentication')).not.toBeInTheDocument();
  });

  it('renders the OTP input and title when mfaPendingToken is set', () => {
    setMfaPending();
    renderPage();
    expect(screen.getByText('Two-factor authentication')).toBeInTheDocument();
    expect(screen.getByTestId('otp-input')).toBeInTheDocument();
  });

  it('calls verifyMfaApi with totpCode on OTP completion and navigates to /orders', async () => {
    setMfaPending();
    vi.mocked(verifyMfaApi).mockResolvedValue({ token: 'full-jwt', user: testUser });

    renderPage();

    fireEvent.change(screen.getByTestId('otp-input'), { target: { value: '123456' } });

    await waitFor(() => {
      expect(verifyMfaApi).toHaveBeenCalledWith('mfa-token-123', { totpCode: '123456' });
      expect(mockNavigate).toHaveBeenCalledWith('/orders', { replace: true });
    });
  });

  it('shows totp_invalid error when verifyMfaApi throws totp_invalid', async () => {
    setMfaPending();
    vi.mocked(verifyMfaApi).mockRejectedValue(new Error('totp_invalid'));

    renderPage();

    fireEvent.change(screen.getByTestId('otp-input'), { target: { value: '000000' } });

    await waitFor(() => {
      expect(screen.getByText('Invalid code. Check your authenticator app and try again.')).toBeInTheDocument();
    });
  });

  it('shows mfa_token_invalid error when session is expired', async () => {
    setMfaPending();
    vi.mocked(verifyMfaApi).mockRejectedValue(new Error('mfa_token_invalid'));

    renderPage();

    fireEvent.change(screen.getByTestId('otp-input'), { target: { value: '111111' } });

    await waitFor(() => {
      expect(screen.getByText('Session expired. Please go back and sign in again.')).toBeInTheDocument();
    });
  });

  it('shows generic error for unknown failures', async () => {
    setMfaPending();
    vi.mocked(verifyMfaApi).mockRejectedValue(new Error('network_error'));

    renderPage();

    fireEvent.change(screen.getByTestId('otp-input'), { target: { value: '222222' } });

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    });
  });

  it('Back button clears MFA state and navigates to /login', async () => {
    setMfaPending();
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /back to sign in/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    expect(useAuthStore.getState().mfaPendingToken).toBeNull();
  });

  it('does not show More options when methods only has totp', () => {
    setMfaPending(['totp']);
    renderPage();
    expect(screen.queryByRole('button', { name: /more options/i })).not.toBeInTheDocument();
  });

  it('shows More options with Recovery code when methods include recovery_code', async () => {
    setMfaPending(['totp', 'recovery_code']);
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));

    expect(screen.getByRole('button', { name: /recovery code/i })).toBeInTheDocument();
  });

  it('shows More options with Passkey when methods include passkey', async () => {
    setMfaPending(['totp', 'passkey', 'recovery_code']);
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));

    expect(screen.getByRole('button', { name: 'Passkey' })).toBeInTheDocument();
  });

  it('shows More options with Email me a code when methods include email_otp', async () => {
    setMfaPending(['totp', 'email_otp']);
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));

    expect(screen.getByRole('button', { name: /email me a code/i })).toBeInTheDocument();
  });

  it('clicking Passkey in More options navigates to /login/two-factor/webauthn', async () => {
    setMfaPending(['totp', 'passkey']);
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Passkey' }));

    expect(mockNavigate).toHaveBeenCalledWith('/login/two-factor/webauthn', { replace: true });
  });

  it('clicking Recovery code in More options navigates to /login/two-factor/recovery', async () => {
    setMfaPending(['totp', 'recovery_code']);
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.click(screen.getByRole('button', { name: /recovery code/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/login/two-factor/recovery', { replace: true });
  });

  it('clicking Email me a code in More options navigates to /login/two-factor/email-otp', async () => {
    setMfaPending(['totp', 'email_otp']);
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.click(screen.getByRole('button', { name: /email me a code/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/login/two-factor/email-otp', { replace: true });
  });
});
