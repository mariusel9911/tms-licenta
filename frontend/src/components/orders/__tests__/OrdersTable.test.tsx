import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrdersTable } from '@/components/orders/OrdersTable';
import { ALL_COLUMN_IDS } from '@/components/orders/TableSettingsModal';
import { buildOrder } from '@/__tests__/helpers/factories';
import type { PaginatedOrders } from '@/types/order.types';

// Mock react-circle-flags (not installed in jsdom image environment)
vi.mock('react-circle-flags', () => ({
  CircleFlag: ({ countryCode }: { countryCode: string }) => (
    <span data-testid={`flag-${countryCode}`} />
  ),
}));

// Mock usePatchOrderStatus used by TableStatusPill
vi.mock('@/hooks/useOrders', () => ({
  usePatchOrderStatus: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  })),
}));

function buildPaginatedOrders(items = [buildOrder()]): PaginatedOrders {
  return { items, total: items.length, page: 1, limit: 20, totalPages: 1 };
}

const defaultHandlers = {
  onPageChange: vi.fn(),
  onLimitChange: vi.fn(),
  onDuplicate: vi.fn(),
  onDelete: vi.fn(),
  onViewDetail: vi.fn(),
  onSendOrder: vi.fn(),
  onSortChange: vi.fn(),
};

function renderTable(props: Partial<Parameters<typeof OrdersTable>[0]> = {}) {
  return render(
    <OrdersTable
      data={buildPaginatedOrders()}
      page={1}
      limit={20}
      visibleColumns={ALL_COLUMN_IDS}
      columnOrder={ALL_COLUMN_IDS}
      sortBy="createdAt"
      sortOrder="desc"
      {...defaultHandlers}
      {...props}
    />,
  );
}

describe('OrdersTable', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders order rows with client name and order number', () => {
    const order = buildOrder({
      id: 1,
      orderNumber: 'BGR1',
      orderSeries: 'BGR',
      client: { id: 1, name: 'Test Partner SRL', country: 'Romania' },
    });
    renderTable({ data: buildPaginatedOrders([order]) });

    // Client name in the Partner column
    expect(screen.getByText('Test Partner SRL')).toBeInTheDocument();
    // Order number stripped of series prefix → "1"
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows "No orders found." when items list is empty', () => {
    renderTable({ data: { items: [], total: 0, page: 1, limit: 20, totalPages: 0 } });
    expect(screen.getByText('No orders found.')).toBeInTheDocument();
  });

  it('calls onSortChange when a sortable column header is clicked', async () => {
    renderTable();
    // Click the "Partner" column header (exact match — "Intermediary partner" also exists)
    const partnerHeader = screen.getByRole('columnheader', { name: 'Partner' });
    await userEvent.click(partnerHeader);
    expect(defaultHandlers.onSortChange).toHaveBeenCalledWith('client.name', 'asc');
  });

  it('shows ✓ for sent orders and — for unsent in the Sent column', () => {
    const sentOrder = buildOrder({ id: 1, orderNumber: 'BGR1', orderSeries: 'BGR', isSent: true });
    const unsentOrder = buildOrder({
      id: 2,
      orderNumber: 'BGR2',
      orderSeries: 'BGR',
      isSent: false,
    });
    renderTable({ data: buildPaginatedOrders([sentOrder, unsentOrder]) });

    expect(screen.getByText('✓')).toBeInTheDocument();
    // "—" appears multiple times (unsent sent column + empty data cells); just verify at least one
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('calls onViewDetail with the order when the Eye button is clicked', async () => {
    const order = buildOrder({ id: 7, orderNumber: 'BGR7', orderSeries: 'BGR' });
    renderTable({ data: buildPaginatedOrders([order]) });

    await userEvent.click(screen.getByTitle('View details'));
    expect(defaultHandlers.onViewDetail).toHaveBeenCalledWith(order);
  });

  it('Send button is disabled when the order is already sent', () => {
    const order = buildOrder({ id: 3, orderNumber: 'BGR3', orderSeries: 'BGR', isSent: true });
    renderTable({ data: buildPaginatedOrders([order]) });

    const sendBtn = screen.getByTitle('Already sent');
    expect(sendBtn).toBeDisabled();
  });

  describe('pagination — first/last buttons', () => {
    const multiPageData = {
      items: [buildOrder()],
      total: 50,
      page: 2,
      limit: 20,
      totalPages: 3,
    };

    it('renders "First page" and "Last page" buttons', () => {
      renderTable({ data: multiPageData, page: 2 });
      expect(screen.getByTitle('First page')).toBeInTheDocument();
      expect(screen.getByTitle('Last page')).toBeInTheDocument();
    });

    it('"First page" button calls onPageChange(1)', async () => {
      renderTable({ data: multiPageData, page: 2 });
      await userEvent.click(screen.getByTitle('First page'));
      expect(defaultHandlers.onPageChange).toHaveBeenCalledWith(1);
    });

    it('"Last page" button calls onPageChange(totalPages)', async () => {
      renderTable({ data: multiPageData, page: 2 });
      await userEvent.click(screen.getByTitle('Last page'));
      expect(defaultHandlers.onPageChange).toHaveBeenCalledWith(3);
    });

    it('"First page" button is disabled when already on page 1', () => {
      renderTable({
        data: { ...multiPageData, page: 1 },
        page: 1,
      });
      expect(screen.getByTitle('First page')).toBeDisabled();
    });

    it('"Last page" button is disabled when already on the last page', () => {
      renderTable({
        data: { ...multiPageData, page: 3 },
        page: 3,
      });
      expect(screen.getByTitle('Last page')).toBeDisabled();
    });
  });

  describe('columnOrder', () => {
    it('renders column headers in columnOrder sequence, not TABLE_COLUMNS source order', () => {
      // Put status first and partner second (reversed from default)
      renderTable({ columnOrder: ['status', 'partner', 'documentDate'] });

      const headers = screen
        .getAllByRole('columnheader')
        .map((th) => th.textContent?.trim());

      const statusIdx = headers.findIndex((h) => h?.includes('Status'));
      const partnerIdx = headers.findIndex((h) => h === 'Partner');
      const docIdx = headers.findIndex((h) => h?.includes('Document'));

      expect(statusIdx).toBeLessThan(partnerIdx);
      expect(partnerIdx).toBeLessThan(docIdx);
    });

    it('only renders columns present in both columnOrder and visibleColumns', () => {
      renderTable({
        visibleColumns: ['partner', 'status'],
        columnOrder: ['status', 'partner', 'documentDate'],
      });

      // status and partner visible; documentDate hidden because not in visibleColumns
      expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: 'Partner' })).toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: /Document/i })).not.toBeInTheDocument();
    });
  });
});
