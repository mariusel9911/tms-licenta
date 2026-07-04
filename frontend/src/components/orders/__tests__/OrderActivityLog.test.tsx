import { render, screen } from '@testing-library/react';
import { OrderActivityLog } from '@/components/orders/OrderActivityLog';
import type { ActivityLogEntry } from '@/api/activity.api';

function buildEntry(overrides: Partial<ActivityLogEntry> = {}): ActivityLogEntry {
  return {
    id: 1,
    orderId: 10,
    userId: 1,
    action: 'created the order',
    details: null,
    createdAt: new Date().toISOString(),
    user: { id: 1, name: 'Admin User' },
    ...overrides,
  };
}

describe('OrderActivityLog', () => {
  it('renders timeline entries with user name and action', () => {
    const entries = [
      buildEntry({ id: 1, action: 'created the order', user: { id: 1, name: 'John Doe' } }),
    ];
    render(<OrderActivityLog entries={entries} isLoading={false} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('created the order')).toBeInTheDocument();
  });

  it('renders "oldValue → newValue" for entries with details JSON', () => {
    const details = JSON.stringify({ field: 'status', oldValue: 'DRAFT', newValue: 'CONFIRMED' });
    const entries = [buildEntry({ id: 2, details, action: 'updated status' })];
    render(<OrderActivityLog entries={entries} isLoading={false} />);

    expect(screen.getByText('DRAFT')).toBeInTheDocument();
    expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
    // Arrow separator rendered as text node
    expect(screen.getByText(/→/)).toBeInTheDocument();
  });

  it('renders plain action text for entries without details', () => {
    const entries = [buildEntry({ id: 3, details: null, action: 'duplicated the order' })];
    render(<OrderActivityLog entries={entries} isLoading={false} />);

    expect(screen.getByText('duplicated the order')).toBeInTheDocument();
    // No arrow separator
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
  });

  it('shows "No activity yet." when entries array is empty', () => {
    render(<OrderActivityLog entries={[]} isLoading={false} />);
    expect(screen.getByText('No activity yet.')).toBeInTheDocument();
  });

  it('shows a loading spinner when isLoading is true', () => {
    const { container } = render(<OrderActivityLog entries={[]} isLoading={true} />);
    // LoadingSpinner renders an SVG
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.queryByText('No activity yet.')).not.toBeInTheDocument();
  });
});
