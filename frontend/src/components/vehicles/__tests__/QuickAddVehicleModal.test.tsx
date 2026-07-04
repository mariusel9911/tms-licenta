import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/__tests__/helpers/query-client';
import { QuickAddVehicleModal } from '@/components/vehicles/QuickAddVehicleModal';
import { buildVehicle } from '@/__tests__/helpers/factories';

// ── Hoisted mocks ──────────────────────────────────────────────────────────────

const mockMutateAsync = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useVehicles', () => ({
  useCreateVehicle: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock('@/hooks/usePartners', () => ({
  usePartnersList: () => ({
    data: {
      items: [
        { id: 10, name: 'Partner A' },
        { id: 20, name: 'Partner B' },
      ],
    },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock Select to use native <select> for testability
vi.mock('@/components/ui/select', () => ({
  Select: ({ onValueChange, value, children }: { onValueChange: (v: string) => void; value: string; children: React.ReactNode }) => (
    <select data-testid="select" value={value ?? ''} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
}));

// ── Helpers ─────────────────────────────────────────────────────────────────────

function renderModal(props: Partial<React.ComponentProps<typeof QuickAddVehicleModal>> = {}) {
  const queryClient = createTestQueryClient();
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onCreated: vi.fn(),
    ...props,
  };
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <QuickAddVehicleModal {...defaultProps} />
      </QueryClientProvider>,
    ),
    ...defaultProps,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────────

describe('QuickAddVehicleModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue(buildVehicle({ id: 99, licensePlate: 'NEW01' }));
  });

  it('renders the dialog when open', () => {
    renderModal();
    expect(screen.getByText('Quick Add Vehicle')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. B 123 ABC')).toBeInTheDocument();
  });

  it('does not render the dialog when closed', () => {
    renderModal({ open: false });
    expect(screen.queryByText('Quick Add Vehicle')).not.toBeInTheDocument();
  });

  it('calls onCreated with the new vehicle and closes on successful submit', async () => {
    const { onCreated } = renderModal({ transporterId: 10 });

    await userEvent.type(screen.getByPlaceholderText('e.g. B 123 ABC'), 'NEW01');
    fireEvent.submit(screen.getByPlaceholderText('e.g. B 123 ABC').closest('form')!);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ licensePlate: 'NEW01', status: 'AVAILABLE', partnerId: 10 }),
      );
    });

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(
        expect.objectContaining({ id: 99, licensePlate: 'NEW01' }),
      );
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Vehicle "NEW01" created' }),
    );
  });

  it('shows error toast when creation fails', async () => {
    mockMutateAsync.mockRejectedValue(new Error('fail'));

    renderModal();
    await userEvent.type(screen.getByPlaceholderText('e.g. B 123 ABC'), 'FAIL01');
    fireEvent.submit(screen.getByPlaceholderText('e.g. B 123 ABC').closest('form')!);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to create vehicle', variant: 'destructive' }),
      );
    });
  });

  it('calls onClose when the Close button is clicked', async () => {
    const { onClose } = renderModal();
    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    // The outline Close button (not the X icon button)
    const outlineClose = closeButtons.find(btn => btn.textContent === 'Close')!;
    await userEvent.click(outlineClose);
    expect(onClose).toHaveBeenCalled();
  });

  it('stops form submit event from propagating to parent forms (portal bubble fix)', async () => {
    // This test verifies the core bug fix: the QuickAddVehicleModal's form
    // submit must NOT bubble through React's portal tree to the parent form.
    const parentSubmitHandler = vi.fn();
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <form onSubmit={parentSubmitHandler} data-testid="parent-form">
          <QuickAddVehicleModal
            open={true}
            onClose={vi.fn()}
            onCreated={vi.fn()}
          />
        </form>
      </QueryClientProvider>,
    );

    // Fill the required field and submit the modal form
    await userEvent.type(screen.getByPlaceholderText('e.g. B 123 ABC'), 'TEST01');

    // Find the modal's form (inside DialogContent portal) and submit it
    const modalForm = screen.getByPlaceholderText('e.g. B 123 ABC').closest('form')!;
    fireEvent.submit(modalForm);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });

    // The parent form's submit handler must NOT have been called
    expect(parentSubmitHandler).not.toHaveBeenCalled();
  });

  it('sends partnerId=undefined when no partner selected and value is 0', async () => {
    renderModal({ transporterId: undefined });

    await userEvent.type(screen.getByPlaceholderText('e.g. B 123 ABC'), 'NOPARTNER');
    fireEvent.submit(screen.getByPlaceholderText('e.g. B 123 ABC').closest('form')!);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ partnerId: undefined }),
      );
    });
  });
});
