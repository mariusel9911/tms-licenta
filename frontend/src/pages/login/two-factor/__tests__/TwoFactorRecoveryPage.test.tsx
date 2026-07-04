import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TwoFactorRecoveryPage from '@/pages/login/two-factor/TwoFactorRecoveryPage';
import { useAuthStore } from '@/store/auth.store';
import { verifyMfaApi } from '@/api/auth.api';

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
      <TwoFactorRecoveryPage />
    </MemoryRouter>,
  );
}

function setMfaPending(methods = ['recovery_code', 'totp']) {
  useAuthStore.setState({
    ...initialAuthState,
    mfaPendingToken: 'mfa-token-123',
    mfaMethods: methods,
    mfaMaskedEmail: null,
  });
}

describe('TwoFactorRecoveryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState(initialAuthState);
  });

  it('redirects to /login when mfaPendingToken is null', () => {
    useAuthStore.setState({ mfaPendingToken: null, mfaMethods: null });
    renderPage();
    expect(screen.queryByText('Two-factor recovery')).not.toBeInTheDocument();
  });

  it('renders the recovery code input and Verify button', () => {
    setMfaPending();
    renderPage();
    expect(screen.getByText('Two-factor recovery')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('XXXXX-XXXXX')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verify/i })).toBeInTheDocument();
  });

  it('Verify button is disabled when input is empty', () => {
    setMfaPending();
    renderPage();
    expect(screen.getByRole('button', { name: /^verify$/i })).toBeDisabled();
  });

  it('calls verifyMfaApi with recoveryCode and navigates to /orders on success', async () => {
    setMfaPending();
    vi.mocked(verifyMfaApi).mockResolvedValue({ token: 'full-jwt', user: testUser });

    renderPage();

    await userEvent.type(screen.getByPlaceholderText('XXXXX-XXXXX'), 'ABCDE-12345');
    await userEvent.click(screen.getByRole('button', { name: /^verify$/i }));

    await waitFor(() => {
      expect(verifyMfaApi).toHaveBeenCalledWith('mfa-token-123', { recoveryCode: 'ABCDE-12345' });
      expect(mockNavigate).toHaveBeenCalledWith('/orders', { replace: true });
    });
  });

  it('shows recovery_code_invalid error when code is invalid', async () => {
    setMfaPending();
    vi.mocked(verifyMfaApi).mockRejectedValue(new Error('recovery_code_invalid'));

    renderPage();

    await userEvent.type(screen.getByPlaceholderText('XXXXX-XXXXX'), 'WRONG-CODE1');
    await userEvent.click(screen.getByRole('button', { name: /^verify$/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid or already-used recovery code.')).toBeInTheDocument();
    });
  });

  it('shows mfa_token_invalid error when session is expired', async () => {
    setMfaPending();
    vi.mocked(verifyMfaApi).mockRejectedValue(new Error('mfa_token_invalid'));

    renderPage();

    await userEvent.type(screen.getByPlaceholderText('XXXXX-XXXXX'), 'ABCDE-12345');
    await userEvent.click(screen.getByRole('button', { name: /^verify$/i }));

    await waitFor(() => {
      expect(screen.getByText('Session expired. Please go back and sign in again.')).toBeInTheDocument();
    });
  });

  it('shows generic error for unknown failures', async () => {
    setMfaPending();
    vi.mocked(verifyMfaApi).mockRejectedValue(new Error('network_error'));

    renderPage();

    await userEvent.type(screen.getByPlaceholderText('XXXXX-XXXXX'), 'ABCDE-12345');
    await userEvent.click(screen.getByRole('button', { name: /^verify$/i }));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    });
  });

  it('submits on Enter key press in the input', async () => {
    setMfaPending();
    vi.mocked(verifyMfaApi).mockResolvedValue({ token: 'full-jwt', user: testUser });

    renderPage();

    const input = screen.getByPlaceholderText('XXXXX-XXXXX');
    await userEvent.type(input, 'ABCDE-12345{Enter}');

    await waitFor(() => {
      expect(verifyMfaApi).toHaveBeenCalledWith('mfa-token-123', { recoveryCode: 'ABCDE-12345' });
    });
  });

  it('Back button clears MFA state and navigates to /login', async () => {
    setMfaPending();
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /back to sign in/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    expect(useAuthStore.getState().mfaPendingToken).toBeNull();
  });

  it('shows More options with Authenticator app when methods include totp', async () => {
    setMfaPending(['recovery_code', 'totp']);
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));

    expect(screen.getByRole('button', { name: /authenticator app/i })).toBeInTheDocument();
  });

  it('shows More options with Passkey when methods include passkey', async () => {
    setMfaPending(['recovery_code', 'passkey', 'totp']);
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));

    expect(screen.getByRole('button', { name: 'Passkey' })).toBeInTheDocument();
  });

  it('shows More options with Email me a code when methods include email_otp', async () => {
    setMfaPending(['recovery_code', 'email_otp']);
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));

    expect(screen.getByRole('button', { name: /email me a code/i })).toBeInTheDocument();
  });

  it('clicking Authenticator app navigates to /login/two-factor/totp', async () => {
    setMfaPending(['recovery_code', 'totp']);
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.click(screen.getByRole('button', { name: /authenticator app/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/login/two-factor/totp', { replace: true });
  });

  it('clicking Passkey navigates to /login/two-factor/webauthn', async () => {
    setMfaPending(['recovery_code', 'passkey']);
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Passkey' }));

    expect(mockNavigate).toHaveBeenCalledWith('/login/two-factor/webauthn', { replace: true });
  });

  it('clicking Email me a code navigates to /login/two-factor/email-otp', async () => {
    setMfaPending(['recovery_code', 'email_otp']);
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /more options/i }));
    await userEvent.click(screen.getByRole('button', { name: /email me a code/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/login/two-factor/email-otp', { replace: true });
  });
});
