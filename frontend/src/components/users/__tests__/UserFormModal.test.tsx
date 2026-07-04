import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { UserFormModal } from '@/components/users/UserFormModal';
import { createTestQueryClient } from '@/__tests__/helpers/query-client';
import type { User } from '@/types/user.types';

// Mock the mutation hooks
const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();

vi.mock('@/hooks/useUsers', () => ({
  useCreateUser: vi.fn(() => ({ mutate: mockCreateMutate, isPending: false })),
  useUpdateUser: vi.fn(() => ({ mutate: mockUpdateMutate, isPending: false })),
}));

// Mock shadcn Select to use a native <select> for reliable testing
vi.mock('@/components/ui/select', () => ({
  Select: ({
    onValueChange,
    value,
    children,
  }: {
    onValueChange: (v: string) => void;
    value: string;
    children: React.ReactNode;
  }) => (
    <select
      data-testid="role-select"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    email: 'user@test.ro',
    name: 'Test User',
    role: 'DISPATCHER',
    isActive: true,
    isSystemAdmin: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderModal(props: { open: boolean; user?: User | null; onClose?: () => void }) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <UserFormModal
        open={props.open}
        user={props.user ?? null}
        onClose={props.onClose ?? vi.fn()}
      />
    </QueryClientProvider>,
  );
}

describe('UserFormModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('create mode renders "New User" title with name, email, password inputs and role select', () => {
    renderModal({ open: true, user: null });

    expect(screen.getByText('New User')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Full name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('user@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Min 8 characters')).toBeInTheDocument();
    expect(screen.getByTestId('role-select')).toBeInTheDocument();
  });

  it('edit mode renders "Edit User" title with name input, role select, and isActive checkbox', () => {
    const user = buildUser({ name: 'John', role: 'ADMIN' });
    renderModal({ open: true, user });

    expect(screen.getByText('Edit User')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Full name')).toBeInTheDocument();
    expect(screen.getByTestId('role-select')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    // No email or password fields in edit mode
    expect(screen.queryByPlaceholderText('user@example.com')).not.toBeInTheDocument();
  });

  it('shows required validation error when name is left empty on create', async () => {
    renderModal({ open: true, user: null });

    // Click Save without filling name
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it('calls createUser mutation with correct data on valid create submit', async () => {
    renderModal({ open: true, user: null });

    await userEvent.type(screen.getByPlaceholderText('Full name'), 'New User');
    await userEvent.type(screen.getByPlaceholderText('user@example.com'), 'new@test.ro');
    await userEvent.type(screen.getByPlaceholderText('Min 8 characters'), 'password123');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockCreateMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New User',
          email: 'new@test.ro',
          password: 'password123',
        }),
        expect.anything(),
      );
    });
  });
});
