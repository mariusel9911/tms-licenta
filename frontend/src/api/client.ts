import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request Interceptor: Inject JWT token ────────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response Interceptor: Handle 401 + 503 (maintenance) ───────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // 503 with maintenance flag → redirect to maintenance page
    if (error.response?.status === 503 && error.response?.data?.maintenance) {
      useAuthStore.getState().logout();
      window.location.replace('/maintenance');
      return Promise.reject(error);
    }

    // 502 = backend container is down (deploy in progress) → maintenance page
    // Guard: skip if already on /maintenance to prevent poll → 502 → reload loop
    // Do NOT logout — token stays valid; user resumes after backend restarts
    if (
      error.response?.status === 502 &&
      !window.location.pathname.startsWith('/maintenance')
    ) {
      window.location.replace('/maintenance');
      return Promise.reject(error);
    }

    const url = error.config?.url ?? '';
    if (
      error.response?.status === 401 &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/mfa/verify') &&
      !url.includes('/auth/mfa/passkey/authenticate/options')
    ) {
      useAuthStore.getState().logout();
      window.location.replace('/login');
    }
    return Promise.reject(error);
  },
);
