import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/store/auth.store';

const initialState = useAuthStore.getState();

const testUser = {
  id: 1,
  email: 'admin@tms.ro',
  name: 'Admin',
  role: 'ADMIN' as const,
  isSystemAdmin: false,
};

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState(initialState);
  });

  it('login() sets token and user, clears mfaPendingToken and mfaMethods', () => {
    useAuthStore.setState({ ...initialState, mfaPendingToken: 'old-mfa', mfaMethods: ['totp'] });

    useAuthStore.getState().login('token-abc', testUser);

    const state = useAuthStore.getState();
    expect(state.token).toBe('token-abc');
    expect(state.user).toEqual(testUser);
    expect(state.mfaPendingToken).toBeNull();
    expect(state.mfaMethods).toBeNull();
  });

  it('logout() clears token, user, mfaPendingToken, and mfaMethods', () => {
    useAuthStore.setState({ token: 'tok', user: testUser, mfaPendingToken: 'mfa', mfaMethods: ['totp'] });

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.mfaPendingToken).toBeNull();
    expect(state.mfaMethods).toBeNull();
  });

  it('setMfaPending() stores the token and methods in state', () => {
    useAuthStore.getState().setMfaPending('mfa-token-123', ['totp', 'recovery_code']);

    const state = useAuthStore.getState();
    expect(state.mfaPendingToken).toBe('mfa-token-123');
    expect(state.mfaMethods).toEqual(['totp', 'recovery_code']);
  });

  it('setMfaPending(null, null) clears the token and methods', () => {
    useAuthStore.setState({ ...initialState, mfaPendingToken: 'existing-mfa', mfaMethods: ['totp'] });

    useAuthStore.getState().setMfaPending(null, null);

    expect(useAuthStore.getState().mfaPendingToken).toBeNull();
    expect(useAuthStore.getState().mfaMethods).toBeNull();
  });

  it('partialize excludes mfaPendingToken and mfaMethods from persisted state', () => {
    type StoreWithPersist = {
      persist: {
        getOptions: () => {
          partialize: (state: Record<string, unknown>) => Record<string, unknown>;
        };
      };
    };
    const persistApi = (useAuthStore as unknown as StoreWithPersist).persist;
    const { partialize } = persistApi.getOptions();

    const fullState = {
      token: 'tok',
      user: testUser,
      mfaPendingToken: 'mfa-secret',
      mfaMethods: ['totp', 'recovery_code'],
      login: () => {},
      logout: () => {},
      setMfaPending: () => {},
    };

    const persisted = partialize(fullState);

    expect(persisted).toHaveProperty('token', 'tok');
    expect(persisted).toHaveProperty('user');
    expect(persisted).not.toHaveProperty('mfaPendingToken');
    expect(persisted).not.toHaveProperty('mfaMethods');
  });
});
