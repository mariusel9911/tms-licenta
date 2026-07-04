import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PrivateRoute } from '@/components/PrivateRoute';
import { useAuthStore } from '@/store/auth.store';

function renderWithRoutes(initialPath: string, hasToken: boolean) {
  const initialState = useAuthStore.getState();
  useAuthStore.setState({ ...initialState, token: hasToken ? 'test-token' : null });

  return render(
    <MemoryRouter
      initialEntries={[initialPath]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<div>Protected Content</div>} />
          <Route path="/orders" element={<div>Orders Page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('PrivateRoute', () => {
  const initialState = useAuthStore.getState();

  afterEach(() => {
    // Unmount before resetting Zustand state — prevents act() warnings from
    // Zustand subscriber re-renders fired on a still-mounted PrivateRoute.
    cleanup();
    useAuthStore.setState(initialState);
  });

  it('renders the outlet (protected content) when token exists', async () => {
    await act(async () => {
      renderWithRoutes('/dashboard', true);
    });
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('redirects to /login when no token', () => {
    renderWithRoutes('/dashboard', false);
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});
