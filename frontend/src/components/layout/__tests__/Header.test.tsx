import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { createTestQueryClient } from '@/__tests__/helpers/query-client';
import { useAuthStore } from '@/store/auth.store';

// Mock useNavigate so we can assert navigation calls
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await import('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock the interactive-hover-button (UI component — not under test)
vi.mock('@/components/ui/interactive-hover-button', () => ({
  InteractiveHoverButton: ({
    text,
    onClick,
    className,
  }: {
    text?: string;
    onClick?: () => void;
    className?: string;
  }) => (
    <button onClick={onClick} className={className}>
      {text}
    </button>
  ),
}));

describe('Header', () => {
  const initialState = useAuthStore.getState();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState(initialState);
  });

  it('shows user name from the auth store', () => {
    useAuthStore.setState({
      ...initialState,
      user: { id: 1, name: 'John Doe', email: 'john@test.ro', role: 'ADMIN', isSystemAdmin: false },
    });
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('logout button clears auth and navigates to /login', async () => {
    useAuthStore.setState({
      ...initialState,
      token: 'test-token',
      user: { id: 2, name: 'Jane', email: 'jane@test.ro', role: 'DISPATCHER', isSystemAdmin: false },
    });
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await userEvent.click(screen.getByText('Logout'));
    // Store should be cleared
    expect(useAuthStore.getState().token).toBeNull();
    // Navigation should redirect to /login
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
