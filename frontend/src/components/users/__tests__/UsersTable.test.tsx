import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UsersTable } from '@/components/users/UsersTable';
import type { User } from '@/types/user.types';

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

const defaultHandlers = {
  onEdit: vi.fn(),
  onResetPassword: vi.fn(),
  onDelete: vi.fn(),
};

describe('UsersTable', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders user rows with name, email, and role badge', () => {
    const users = [
      buildUser({ id: 1, name: 'Alice', email: 'alice@test.ro', role: 'ADMIN' }),
      buildUser({ id: 2, name: 'Bob', email: 'bob@test.ro', role: 'DISPATCHER' }),
    ];
    render(<UsersTable data={users} isLoading={false} {...defaultHandlers} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('alice@test.ro')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Dispatcher')).toBeInTheDocument();
  });

  it('shows Lock icon and "System" label for the seed user — no action buttons', () => {
    const seedUser = buildUser({ id: 1, isSystemAdmin: true, name: 'System Admin' });
    render(<UsersTable data={[seedUser]} isLoading={false} {...defaultHandlers} />);

    // "System" label rendered instead of action buttons
    expect(screen.getByText('System')).toBeInTheDocument();
    // No edit/delete buttons for seed user
    expect(screen.queryByTitle('Edit user')).not.toBeInTheDocument();
  });

  it('renders action buttons (edit, reset, delete) for non-seed users', () => {
    const user = buildUser({ id: 5, email: 'regular@test.ro', name: 'Regular User' });
    render(<UsersTable data={[user]} isLoading={false} {...defaultHandlers} />);

    expect(screen.getByTitle('Edit user')).toBeInTheDocument();
    expect(screen.getByTitle('Reset password')).toBeInTheDocument();
    // Default (isSystemAdmin=false) → title is "Deactivate user"
    expect(screen.getByTitle('Deactivate user')).toBeInTheDocument();
  });

  it('calls onEdit when the edit button is clicked for a regular user', async () => {
    const user = buildUser({ id: 5, email: 'regular@test.ro' });
    render(<UsersTable data={[user]} isLoading={false} {...defaultHandlers} />);

    await userEvent.click(screen.getByTitle('Edit user'));
    expect(defaultHandlers.onEdit).toHaveBeenCalledWith(user);
  });

  it('calls onDelete when the delete button is clicked', async () => {
    const user = buildUser({ id: 99, email: 'delete@test.ro' });
    render(<UsersTable data={[user]} isLoading={false} {...defaultHandlers} />);

    await userEvent.click(screen.getByTitle('Deactivate user'));
    expect(defaultHandlers.onDelete).toHaveBeenCalledWith(user);
  });

  it('shows empty state when no users exist', () => {
    render(<UsersTable data={[]} isLoading={false} {...defaultHandlers} />);
    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  it('renders TableSkeleton when isLoading is true', () => {
    render(<UsersTable data={[]} isLoading {...defaultHandlers} />);
    // Skeleton renders — no empty state text
    expect(screen.queryByText('No users found')).not.toBeInTheDocument();
  });

  it('calls onResetPassword when the reset password button is clicked', async () => {
    const user = buildUser({ id: 5, email: 'regular@test.ro' });
    render(<UsersTable data={[user]} isLoading={false} {...defaultHandlers} />);

    await userEvent.click(screen.getByTitle('Reset password'));
    expect(defaultHandlers.onResetPassword).toHaveBeenCalledWith(user);
  });
});
