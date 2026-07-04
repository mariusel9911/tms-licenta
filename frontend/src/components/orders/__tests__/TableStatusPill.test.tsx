import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TableStatusPill } from '@/components/orders/TableStatusPill';

// Mock the usePatchOrderStatus hook — it does server communication
vi.mock('@/hooks/useOrders', () => ({
  usePatchOrderStatus: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  })),
}));

describe('TableStatusPill', () => {
  it('renders the current status label with matching color class', () => {
    render(<TableStatusPill orderId={1} currentStatus="DRAFT" />);
    const pill = screen.getByRole('button', { name: 'Draft' });
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveClass('bg-gray-500');
  });

  it('opens the status popover when the pill is clicked', async () => {
    render(<TableStatusPill orderId={1} currentStatus="DRAFT" />);
    await userEvent.click(screen.getByRole('button', { name: 'Draft' }));

    // DRAFT valid transitions: CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED (not DRAFT itself)
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Delivered')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    // DRAFT is not a valid transition from DRAFT — only the pill trigger shows "Draft"
    expect(screen.getAllByText('Draft').length).toBe(1);
  });

  it('shows ConfirmDialog when a different status option is selected', async () => {
    render(<TableStatusPill orderId={1} currentStatus="DRAFT" />);

    // Open the popover
    await userEvent.click(screen.getByRole('button', { name: 'Draft' }));

    // Click a different status
    const confirmedOption = screen.getByText('Confirmed');
    await userEvent.click(confirmedOption);

    // ConfirmDialog should appear
    expect(screen.getByText('Change Order Status')).toBeInTheDocument();
    expect(screen.getByText(/Change status from "Draft" to "Confirmed"/)).toBeInTheDocument();
  });

  it('does not open ConfirmDialog when the current status is selected', async () => {
    render(<TableStatusPill orderId={1} currentStatus="CONFIRMED" />);

    await userEvent.click(screen.getByRole('button', { name: 'Confirmed' }));

    // Click the same status
    const confirmedOptions = screen.getAllByText('Confirmed');
    await userEvent.click(confirmedOptions[confirmedOptions.length - 1]);

    // ConfirmDialog should NOT appear (no "Change Order Status" title)
    expect(screen.queryByText('Change Order Status')).not.toBeInTheDocument();
  });
});
