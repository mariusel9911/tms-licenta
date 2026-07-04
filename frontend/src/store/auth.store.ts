import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: 'ADMIN' | 'DISPATCHER';
  isSystemAdmin: boolean;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  mfaPendingToken: string | null;
  mfaMethods: string[] | null;
  mfaMaskedEmail: string | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  setMfaPending: (token: string | null, methods: string[] | null, maskedEmail?: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      mfaPendingToken: null,
      mfaMethods: null,
      mfaMaskedEmail: null,
      login: (token, user) => set({ token, user, mfaPendingToken: null, mfaMethods: null, mfaMaskedEmail: null }),
      logout: () => set({ token: null, user: null, mfaPendingToken: null, mfaMethods: null, mfaMaskedEmail: null }),
      setMfaPending: (token, methods, maskedEmail) =>
        set({ mfaPendingToken: token, mfaMethods: methods, mfaMaskedEmail: maskedEmail ?? null }),
    }),
    {
      name: 'tms-auth',
      // Only persist token and user — NOT mfaPendingToken / mfaMethods / mfaMaskedEmail (short-lived)
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);
