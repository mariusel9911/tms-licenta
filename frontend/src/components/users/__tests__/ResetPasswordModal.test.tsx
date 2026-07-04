import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { ResetPasswordModal } from '@/components/users/ResetPasswordModal';
import { createTestQueryClient } from '@/__tests__/helpers/query-client';
import type { User } from '@/types/user.types';

// Mock the useResetUserPassword hook
const mockMutate = vi.fn();

vi.mock('@/hooks/useUsers', () => ({
  useResetUserPassword: vi.fn(() => ({
    mutate: mockMutate,
    isPending: false,
  })),
}));

const testUser: User = {
  id: 5,
  email: 'user@test.ro',
  name: 'Jane Smith',
  role: 'DISPATCHER',
  isActive: true,
  isSystemAdmin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderModal(user: User | null = testUser) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <ResetPasswordModal open={true} user={user} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe('ResetPasswordModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a validation error when passwords do not match', async () => {
    renderModal();

    await userEvent.type(screen.getByPlaceholderText('Min 8 characters'), 'password123');
    await userEvent.type(screen.getByPlaceholderText('Repeat password'), 'different456');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('calls the mutation with new password when passwords match', async () => {
    renderModal();

    await userEvent.type(screen.getByPlaceholderText('Min 8 characters'), 'newSecret123');
    await userEvent.type(screen.getByPlaceholderText('Repeat password'), 'newSecret123');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 5, newPassword: 'newSecret123' }),
        expect.anything(),
      );
    });
  });
});
