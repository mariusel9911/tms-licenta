import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Use vi.hoisted() so mocks are available when vi.mock factory runs ────────
const { mockLogout, mockGetState } = vi.hoisted(() => {
  const mockLogout = vi.fn();
  const mockGetState = vi.fn(() => ({ token: null as string | null, logout: mockLogout }));
  return { mockLogout, mockGetState };
});

vi.mock('@/store/auth.store', () => ({
  useAuthStore: { getState: mockGetState },
}));

import { apiClient } from '@/api/client';

// ── Interceptor access helpers ────────────────────────────────────────────────
type Handler = {
  fulfilled:
    | ((
        config: Record<string, unknown>,
      ) => Record<string, unknown> | Promise<Record<string, unknown>>)
    | null;
  rejected: ((error: unknown) => unknown) | null;
  synchronous?: boolean;
};

type InterceptorManager = { handlers: Array<Handler | null> };

function getReqInterceptor() {
  const mgr = apiClient.interceptors.request as unknown as InterceptorManager;
  return mgr.handlers.find(Boolean)!;
}

function getResInterceptor() {
  const mgr = apiClient.interceptors.response as unknown as InterceptorManager;
  return mgr.handlers.find(Boolean)!;
}

describe('apiClient interceptors', () => {
  const mockReplace = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply default after clearAllMocks (vi.hoisted mocks retain implementation after clear)
    mockGetState.mockReturnValue({ token: null, logout: mockLogout });
    // Reset window.location for each test
    Object.defineProperty(window, 'location', {
      value: { href: '', replace: mockReplace },
      writable: true,
    });
  });

  describe('request interceptor', () => {
    it('injects Authorization header when token exists', async () => {
      mockGetState.mockReturnValue({ token: 'my-jwt-token', logout: mockLogout });

      const config = { headers: {} as Record<string, string> };
      const result = (await getReqInterceptor().fulfilled!(config)) as {
        headers: Record<string, string>;
      };

      expect(result.headers['Authorization']).toBe('Bearer my-jwt-token');
    });

    it('does not inject Authorization header when no token', async () => {
      mockGetState.mockReturnValue({ token: null, logout: mockLogout });

      const config = { headers: {} as Record<string, string> };
      const result = (await getReqInterceptor().fulfilled!(config)) as {
        headers: Record<string, string>;
      };

      expect(result.headers['Authorization']).toBeUndefined();
    });
  });

  describe('response interceptor — 401 handling', () => {
    beforeEach(() => {
      mockGetState.mockReturnValue({ token: 'tok', logout: mockLogout });
    });

    it('calls logout and redirects to /login on 401 for protected routes', async () => {
      const error = { response: { status: 401 }, config: { url: '/orders' } };

      await expect(getResInterceptor().rejected!(error)).rejects.toEqual(error);

      expect(mockLogout).toHaveBeenCalledOnce();
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });

    it('does NOT redirect on 401 for /auth/login endpoint', async () => {
      const error = { response: { status: 401 }, config: { url: '/auth/login' } };

      await expect(getResInterceptor().rejected!(error)).rejects.toEqual(error);

      expect(mockLogout).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('does NOT redirect on 401 for /auth/mfa/verify endpoint', async () => {
      const error = { response: { status: 401 }, config: { url: '/auth/mfa/verify' } };

      await expect(getResInterceptor().rejected!(error)).rejects.toEqual(error);

      expect(mockLogout).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });
});
