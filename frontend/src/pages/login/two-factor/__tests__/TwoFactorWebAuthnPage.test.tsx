import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TwoFactorWebAuthnPage from '@/pages/login/two-factor/TwoFactorWebAuthnPage';
import { useAuthStore } from '@/store/auth.store';
import { getPasskeyAuthenticationOptionsApi, verifyMfaApi } from '@/api/auth.api';

// ── UI mocks ──────────────────────────────────────────────────────────────

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

// ── WebAuthn browser mock ─────────────────────────────────────────────────

const mockStartAuthentication = vi.fn();
vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: (...args: unknown[]) => mockStartAuthentication(...args),
}));

// ── API mocks ─────────────────────────────────────────────────────────────

vi.mock('@/api/auth.api', () => ({
  getPasskeyAuthenticationOptionsApi: vi.fn(),
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
const mockOptions = { challenge: 'abc123', allowCredentials: [] };
const mockAuthResponse = { id: 'cred-id', type: 'public-key' };

function renderPage() {
  return render(
    <MemoryRouter>
      <TwoFactorWebAuthnPage />
    </MemoryRouter>,
  );
}

function setMfaPending(methods = ['passkey', 'totp', 'recovery_code']) {
  useAuthStore.setState({
    ...initialAuthState,
    mfaPendingToken: 'mfa-token-123',
    mfaMethods: methods,
    mfaMaskedEmail: null,
  });
}

describe('TwoFactorWebAuthnPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState(initialAuthState);
  });

  it('redirects to /login when mfaPendingToken is null', () => {
    useAuthStore.setState({ mfaPendingToken: null, mfaMethods: null });
    renderPage();
    expect(screen.queryByText('Two-factor authentication')).not.toBeInTheDocument();
  });

  it('renders the Use passkey button and title', () => {
    setMfaPending();
    renderPage();
    expect(screen.getByText('Two-factor authentication')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /use passkey/i })).toBeInTheDocument();
  });

  it('clicking Use passkey calls APIs and navigates to /orders on success', async () => {
    setMfaPending();
    vi.mocked(getPasskeyAuthenticationOptionsApi).mockResolvedValue(mockOptions);
    mockStartAuthentication.mockResolvedValue(mockAuthResponse);
    vi.mocked(verifyMfaApi).mockResolvedValue({ token: 'full-jwt', user: testUser });

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /use passkey/i }));

    await waitFor(() => {
      expect(getPasskeyAuthenticationOptionsApi).toHaveBeenCalledWith('mfa-token-123');
      expect(mockStartAuthentication).toHaveBeenCalled();
      expect(verifyMfaApi).toHaveBeenCalledWith('mfa-token-123', {
        webauthnResponse: mockAuthResponse,
      });
      expect(mockNavigate).toHaveBeenCalledWith('/orders', { replace: true });
    });
  });

  it('shows authentication failed error on NotAllowedError', async () => {
    setMfaPending();
    vi.mocked(getPasskeyAuthenticationOptionsApi).mockResolvedValue(mockOptions);
    const notAllowedError = new Error('User gesture required');
    notAllowedError.name = 'NotAllowedError';
    mockStartAuthentication.mockRejectedValue(notAllowedError);

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /use passkey/i }));

    await waitFor(() => {
      expect(screen.getByText('Authentication failed.')).toBeInTheDocument();
    });
  });

  it('shows passkey verification failed error on webauthn_invalid', async () => {
    setMfaPending();
    vi.mocked(getPasskeyAuthenticationOptionsApi).mockResolvedValue(mockOptions);
    mockStartAuthentication.mockResolvedValue(mockAuthResponse);
    vi.mocked(verifyMfaApi).mockRejectedValue(new Error('webauthn_invalid'));

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /use passkey/i }));

    await waitFor(() => {
      expect(screen.getByText('Passkey verification failed. Please try again.')).toBeInTheDocument();
    });
  });

  it('shows session expired error on mfa_token_invalid', async () => {
    setMfaPending();
    vi.mocked(getPasskeyAuthenticationOptionsApi).mockRejectedValue(new Error('mfa_token_invalid'));

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /use passkey/i }));

    await waitFor(() => {
      expect(screen.getByText('Session expired. Please go back and sign in again.')).toBeInTheDocument();
    });
  });

  it('shows generic error on unknown failure', async () => {
    setMfaPending();
    vi.mocked(getPasskeyAuthenticationOptionsApi).mockRejectedValue(new Error('network_error'));

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /use passkey/i }));

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

  it('does not show More options when only passkey method', () => {
    setMfaPending(['passkey']);
    renderPage();
    expect(screen.queryByRole('button', { name: /more options/i })).not.toBeInTheDocument();
  });

  it('shows More options with Authenticator app when methods include totp', async () => {
    setMfaPending(['passkey', 'totp']);
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));

    expect(screen.getByRole('button', { name: /authenticator app/i })).toBeInTheDocument();
  });

  it('shows More options with Recovery code when methods include recovery_code', async () => {
    setMfaPending(['passkey', 'recovery_code']);
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));

    expect(screen.getByRole('button', { name: /recovery code/i })).toBeInTheDocument();
  });

  it('shows More options with Email me a code when methods include email_otp', async () => {
    setMfaPending(['passkey', 'email_otp']);
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));

    expect(screen.getByRole('button', { name: /email me a code/i })).toBeInTheDocument();
  });

  it('clicking Authenticator app navigates to /login/two-factor/totp', async () => {
    setMfaPending(['passkey', 'totp']);
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.click(screen.getByRole('button', { name: /authenticator app/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/login/two-factor/totp', { replace: true });
  });

  it('clicking Recovery code navigates to /login/two-factor/recovery', async () => {
    setMfaPending(['passkey', 'recovery_code']);
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.click(screen.getByRole('button', { name: /recovery code/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/login/two-factor/recovery', { replace: true });
  });

  it('clicking Email me a code navigates to /login/two-factor/email-otp', async () => {
    setMfaPending(['passkey', 'email_otp']);
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.click(screen.getByRole('button', { name: /email me a code/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/login/two-factor/email-otp', { replace: true });
  });
});
