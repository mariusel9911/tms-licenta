import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrderFilters } from '@/components/orders/OrderFilters';
import type { OrderFilters as OrderFiltersType } from '@/types/order.types';

// Status filter is now a Popover — always render content so buttons are queryable
vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverAnchor: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// DatePicker replaced native <input type="date"> — mock with a simple input that
// preserves the `title` attribute used by the date tests below
vi.mock('@/components/ui/date-picker', () => ({
  DatePicker: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange: (v: string) => void;
    placeholder?: string;
  }) => (
    <input
      title={placeholder === 'From date' ? 'Date from' : 'Date to'}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const defaultFilters: OrderFiltersType = {};
const defaultHandlers = {
  onFiltersChange: vi.fn(),
  onNewOrder: vi.fn(),
  onExport: vi.fn(),
  onOpenTableSettings: vi.fn(),
  onLoadArchive: vi.fn(),
};

function renderFilters(filters: OrderFiltersType = defaultFilters) {
  return render(<OrderFilters filters={filters} {...defaultHandlers} />);
}

describe('OrderFilters', () => {
  beforeEach(() => vi.clearAllMocks());

  it('debounces the search input — onFiltersChange fires after 200ms', async () => {
    renderFilters();
    const searchInput = screen.getByPlaceholderText('Search orders...');

    await userEvent.type(searchInput, 'test');

    // Wait for the 200ms debounce to fire
    await waitFor(
      () => {
        expect(defaultHandlers.onFiltersChange).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'test' }),
        );
      },
      { timeout: 500 },
    );
  });

  it('clears search and calls onFiltersChange with undefined search', async () => {
    renderFilters({ search: 'existing' });
    const searchInput = screen.getByPlaceholderText('Search orders...');
    expect(searchInput).toHaveValue('existing');

    await userEvent.clear(searchInput);

    await waitFor(
      () => {
        expect(defaultHandlers.onFiltersChange).toHaveBeenCalledWith(
          expect.objectContaining({ search: undefined }),
        );
      },
      { timeout: 500 },
    );
  });

  it('calls onFiltersChange with the selected status when status filter changes', async () => {
    renderFilters();
    // Status is now a Popover with buttons — Popover mock always renders content
    await userEvent.click(screen.getByRole('button', { name: /^draft$/i }));

    expect(defaultHandlers.onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'DRAFT' }),
    );
  });

  it('calls onNewOrder when the New Order button is clicked', async () => {
    renderFilters();
    await userEvent.click(screen.getByText('+ New Order'));
    expect(defaultHandlers.onNewOrder).toHaveBeenCalledOnce();
  });

  it('calls onExport when the Export button is clicked', async () => {
    renderFilters();
    await userEvent.click(screen.getByText('EXPORT'));
    expect(defaultHandlers.onExport).toHaveBeenCalledOnce();
  });

  it('calls onOpenTableSettings when the Table Settings button is clicked', async () => {
    renderFilters();
    await userEvent.click(screen.getByText('TABLE SETTINGS'));
    expect(defaultHandlers.onOpenTableSettings).toHaveBeenCalledOnce();
  });

  it('date-from input change calls onFiltersChange with dateFrom value', async () => {
    renderFilters();
    const dateFromInput = screen.getByTitle('Date from');
    await userEvent.type(dateFromInput, '2026-01-01');
    expect(defaultHandlers.onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ dateFrom: expect.any(String) }),
    );
  });

  it('date-to input change calls onFiltersChange with dateTo value', async () => {
    renderFilters();
    const dateToInput = screen.getByTitle('Date to');
    await userEvent.type(dateToInput, '2026-12-31');
    expect(defaultHandlers.onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ dateTo: expect.any(String) }),
    );
  });

  it('ARCHIVED ORDERS button opens the archive date range dialog', async () => {
    renderFilters({ archived: false });
    await userEvent.click(screen.getByText('ARCHIVED ORDERS'));
    expect(screen.getByText('Load Archived Orders')).toBeInTheDocument();
  });
});
