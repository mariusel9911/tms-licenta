import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { PasskeysList } from '@/components/security/PasskeysList';
import { createTestQueryClient } from '@/__tests__/helpers/query-client';

const mockUsePasskeys = vi.fn();
const mockMutate = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  usePasskeys: () => mockUsePasskeys(),
  useRemovePasskey: () => ({ mutate: mockMutate, isPending: false }),
  useRenamePasskey: () => ({ mutate: mockMutate, isPending: false }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const passkeys = [
  { id: 'pk-1', deviceName: 'My YubiKey', createdAt: '2026-01-15T00:00:00Z' },
  { id: 'pk-2', deviceName: 'Touch ID', createdAt: '2026-02-01T00:00:00Z' },
];

function renderList() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <PasskeysList />
    </QueryClientProvider>,
  );
}

describe('PasskeysList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no passkeys registered', () => {
    mockUsePasskeys.mockReturnValue({ data: [], isLoading: false });
    renderList();

    expect(screen.getByText('No passkeys registered yet.')).toBeInTheDocument();
  });

  it('renders passkey list with device names', () => {
    mockUsePasskeys.mockReturnValue({ data: passkeys, isLoading: false });
    renderList();

    expect(screen.getByText('My YubiKey')).toBeInTheDocument();
    expect(screen.getByText('Touch ID')).toBeInTheDocument();
  });

  it('shows loading skeletons when loading', () => {
    mockUsePasskeys.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = renderList();

    // Skeleton divs are rendered (2 by default)
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('enters rename mode when pencil button is clicked', async () => {
    mockUsePasskeys.mockReturnValue({ data: passkeys, isLoading: false });
    renderList();

    // Click the first pencil (rename) button
    const pencilButtons = screen.getAllByRole('button').filter((b) => {
      const svg = b.querySelector('svg');
      return svg !== null && b.className.includes('text-gray-400');
    });
    await userEvent.click(pencilButtons[0]);

    // Input should appear with current device name
    const input = screen.getByDisplayValue('My YubiKey');
    expect(input).toBeInTheDocument();
  });

  it('shows confirm dialog when trash button is clicked', async () => {
    mockUsePasskeys.mockReturnValue({ data: passkeys, isLoading: false });
    renderList();

    // Click the first trash button (red)
    const trashButtons = screen.getAllByRole('button').filter((b) =>
      b.className.includes('text-red-400'),
    );
    await userEvent.click(trashButtons[0]);

    expect(screen.getByText('Remove Passkey')).toBeInTheDocument();
  });
});
