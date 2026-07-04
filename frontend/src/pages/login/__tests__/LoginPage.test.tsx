import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '@/pages/login/LoginPage';
import { useAuthStore } from '@/store/auth.store';
import { loginApi, getPasskeyLoginOptionsApi, verifyPasskeyLoginApi } from '@/api/auth.api';

// ── UI component mocks (animation not supported in jsdom) ─────────────────

vi.mock('@/components/ui/background-paths', () => ({
  FloatingPaths: () => null,
}));

vi.mock('@/components/ui/animated-theme-toggle', () => ({
  AnimatedThemeToggle: () => null,
}));

// ── WebAuthn browser mock ──────────────────────────────────────────────────

const mockStartAuthentication = vi.fn();
vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: (...args: unknown[]) => mockStartAuthentication(...args),
}));

// ── API mocks ──────────────────────────────────────────────────────────────

vi.mock('@/api/auth.api', () => ({
  loginApi: vi.fn(),
  getPasskeyLoginOptionsApi: vi.fn(),
  verifyPasskeyLoginApi: vi.fn(),
}));

// ── Router mock — intercept navigate() calls ───────────────────────────────

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── Helpers ────────────────────────────────────────────────────────────────

const initialAuthState = useAuthStore.getState();

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState(initialAuthState);
  });

  it('renders email and password fields with Sign in button', () => {
    renderPage();

    expect(screen.getByPlaceholderText('hello@tms.ro')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows invalid-credentials error when login fails', async () => {
    vi.mocked(loginApi).mockRejectedValue({ code: 'invalid_credentials' });

    renderPage();

    await userEvent.type(screen.getByPlaceholderText('hello@tms.ro'), 'admin@tms.ro');
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'badpassword');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password.')).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('calls navigate("/orders") on successful login', async () => {
    vi.mocked(loginApi).mockResolvedValue({
      token: 'jwt-token',
      user: { id: 1, email: 'admin@tms.ro', name: 'Admin', role: 'ADMIN', isSystemAdmin: false },
    });

    renderPage();

    await userEvent.type(screen.getByPlaceholderText('hello@tms.ro'), 'admin@tms.ro');
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'admin123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/orders', { replace: true });
    });
  });

  it('navigates to /login/two-factor/totp when loginApi returns mfaRequired (no passkey)', async () => {
    vi.mocked(loginApi).mockResolvedValue({
      mfaRequired: true,
      mfaToken: 'mfa-pending-token',
      methods: ['totp', 'recovery_code'],
      maskedEmail: 'a***@tms.ro',
    });

    renderPage();

    await userEvent.type(screen.getByPlaceholderText('hello@tms.ro'), 'admin@tms.ro');
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'admin123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login/two-factor/totp', { replace: true });
    });

    // Verify the MFA state was stored
    const state = useAuthStore.getState();
    expect(state.mfaPendingToken).toBe('mfa-pending-token');
    expect(state.mfaMethods).toEqual(['totp', 'recovery_code']);
  });

  it('navigates to /login/two-factor/webauthn when passkey is first method', async () => {
    vi.mocked(loginApi).mockResolvedValue({
      mfaRequired: true,
      mfaToken: 'mfa-pending-token',
      methods: ['passkey', 'totp', 'recovery_code'],
      maskedEmail: 'a***@tms.ro',
    });

    renderPage();

    await userEvent.type(screen.getByPlaceholderText('hello@tms.ro'), 'admin@tms.ro');
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'admin123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login/two-factor/webauthn', { replace: true });
    });

    const state = useAuthStore.getState();
    expect(state.mfaMethods).toEqual(['passkey', 'totp', 'recovery_code']);
  });

  it('shows account_locked error with remaining minutes', async () => {
    vi.mocked(loginApi).mockRejectedValue({ code: 'account_locked', remainingMin: 10 });

    renderPage();

    await userEvent.type(screen.getByPlaceholderText('hello@tms.ro'), 'admin@tms.ro');
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'badpassword');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Account locked. Try again in 10 minute(s).')).toBeInTheDocument();
    });
  });

  it('shows generic error when loginApi throws an unknown error', async () => {
    vi.mocked(loginApi).mockRejectedValue({ code: 'server_error' });

    renderPage();

    await userEvent.type(screen.getByPlaceholderText('hello@tms.ro'), 'admin@tms.ro');
    await userEvent.type(screen.getByPlaceholderText('••••••••'), 'admin123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    });
  });

  // ── Passkey login (standalone) ─────────────────────────────────────────────

  it('clicking "Use a passkey instead" button triggers passkey login and navigates to /orders', async () => {
    vi.mocked(getPasskeyLoginOptionsApi).mockResolvedValue({
      options: { challenge: 'abc', allowCredentials: [] },
      passkeyLoginToken: 'passkey-login-token',
    });
    mockStartAuthentication.mockResolvedValue({ id: 'cred-id', type: 'public-key' });
    vi.mocked(verifyPasskeyLoginApi).mockResolvedValue({
      token: 'full-jwt',
      user: { id: 1, email: 'admin@tms.ro', name: 'Admin', role: 'ADMIN', isSystemAdmin: false },
    });

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /use a passkey instead/i }));

    await waitFor(() => {
      expect(getPasskeyLoginOptionsApi).toHaveBeenCalled();
      expect(mockStartAuthentication).toHaveBeenCalled();
      expect(verifyPasskeyLoginApi).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/orders', { replace: true });
    });
  });

  it('passkey login shows generic error on NotAllowedError', async () => {
    vi.mocked(getPasskeyLoginOptionsApi).mockResolvedValue({
      options: {},
      passkeyLoginToken: 'token',
    });
    const notAllowed = new Error('User gesture required');
    notAllowed.name = 'NotAllowedError';
    mockStartAuthentication.mockRejectedValue(notAllowed);

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /use a passkey instead/i }));

    await waitFor(() => {
      expect(screen.getByText('Authentication failed.')).toBeInTheDocument();
    });
  });

  it('passkey login shows specific error on webauthn_invalid', async () => {
    vi.mocked(getPasskeyLoginOptionsApi).mockResolvedValue({
      options: {},
      passkeyLoginToken: 'token',
    });
    mockStartAuthentication.mockResolvedValue({ id: 'cred' });
    vi.mocked(verifyPasskeyLoginApi).mockRejectedValue(new Error('webauthn_invalid'));

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /use a passkey instead/i }));

    await waitFor(() => {
      expect(screen.getByText('Passkey verification failed. Please try again.')).toBeInTheDocument();
    });
  });

  it('passkey login shows session expired error on passkey_challenge_expired', async () => {
    vi.mocked(getPasskeyLoginOptionsApi).mockRejectedValue(new Error('passkey_challenge_expired'));

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /use a passkey instead/i }));

    await waitFor(() => {
      expect(screen.getByText('Session expired. Please try again.')).toBeInTheDocument();
    });
  });

  it('passkey login shows generic error for unknown failures', async () => {
    vi.mocked(getPasskeyLoginOptionsApi).mockRejectedValue(new Error('network_error'));

    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /use a passkey instead/i }));

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument();
    });
  });
});
