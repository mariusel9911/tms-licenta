import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import OrdersPage from '@/pages/OrdersPage';
import { createTestQueryClient } from '@/__tests__/helpers/query-client';
import { buildOrder } from '@/__tests__/helpers/factories';
import type { PaginatedOrders } from '@/types/order.types';
import type { OrderFilters as OrderFiltersType } from '@/types/order.types';

// ── Heavy child-component mocks ─────────────────────────────────────────────
// These components have deep dependency trees; mock them to focus on page logic.

vi.mock('@/components/orders/CharteringAgreementForm', () => ({
  CharteringAgreementForm: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="chartering-form">
      <button onClick={onClose} data-testid="close-form-btn">Close</button>
    </div>
  ),
}));

vi.mock('@/components/orders/OrderDetailPage', () => ({
  OrderDetailPage: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="order-detail">
      <button onClick={onClose} data-testid="close-detail-btn">Close</button>
    </div>
  ),
}));

vi.mock('@/components/orders/OrdersTable', () => ({
  OrdersTable: ({
    data,
    onViewDetail,
    onDelete,
    onSendOrder,
    onPageChange,
    onLimitChange,
    onSortChange,
  }: {
    data: PaginatedOrders;
    onViewDetail: (o: ReturnType<typeof buildOrder>) => void;
    onDelete?: (o: ReturnType<typeof buildOrder>) => void;
    onSendOrder?: (o: ReturnType<typeof buildOrder>) => void;
    onPageChange?: (p: number) => void;
    onLimitChange?: (l: number) => void;
    onSortChange?: (col: string, dir: 'asc' | 'desc') => void;
  }) => (
    <div data-testid="orders-table">
      {data.items.map((o) => (
        <div key={o.id}>
          <button data-testid={`view-detail-${o.id}`} onClick={() => onViewDetail(o)}>
            View {o.orderNumber}
          </button>
          {onDelete && (
            <button data-testid={`delete-${o.id}`} onClick={() => onDelete(o)}>
              Delete
            </button>
          )}
          {onSendOrder && (
            <button data-testid={`send-${o.id}`} onClick={() => onSendOrder(o)}>
              Send
            </button>
          )}
        </div>
      ))}
      {onPageChange && (
        <button data-testid="next-page" onClick={() => onPageChange(2)}>Next</button>
      )}
      {onLimitChange && (
        <button data-testid="change-limit" onClick={() => onLimitChange(50)}>50/page</button>
      )}
      {onSortChange && (
        <button data-testid="sort-btn" onClick={() => onSortChange('orderNumber', 'asc')}>Sort</button>
      )}
    </div>
  ),
}));

vi.mock('@/components/common/ConfirmDialog', () => ({
  ConfirmDialog: ({
    open,
    title,
    onConfirm,
    onCancel,
    isPending,
  }: {
    open: boolean;
    title: string;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
    isPending?: boolean;
  }) => open ? (
    <div data-testid="confirm-dialog">
      <p data-testid="confirm-title">{title}</p>
      <button data-testid="confirm-btn" onClick={() => void onConfirm()} disabled={isPending}>Confirm</button>
      <button data-testid="cancel-btn" onClick={onCancel}>Cancel</button>
    </div>
  ) : null,
}));

vi.mock('@/components/orders/OrderFilters', () => ({
  OrderFilters: ({
    onNewOrder,
    onFiltersChange,
    onExport,
  }: {
    onNewOrder: () => void;
    onFiltersChange: (f: OrderFiltersType) => void;
    onExport: () => void;
  }) => (
    <div data-testid="order-filters">
      <button data-testid="new-order-btn" onClick={onNewOrder}>
        New Order
      </button>
      <button data-testid="export-btn" onClick={onExport}>
        Export CSV
      </button>
      <input
        data-testid="search-input"
        placeholder="Search orders..."
        onChange={(e) => onFiltersChange({ search: e.target.value })}
      />
    </div>
  ),
}));

vi.mock('@/components/orders/TableSettingsModal', () => ({
  TableSettingsModal: () => null,
  ALL_COLUMN_IDS: ['status', 'client', 'transporter'],
  STORAGE_KEY: 'tms-orders-table-columns',
  loadColumnPrefs: () => ({
    visible: ['status', 'client', 'transporter'],
    order: ['status', 'client', 'transporter'],
  }),
  saveColumnPrefs: vi.fn(),
}));

// ── Hook mocks ──────────────────────────────────────────────────────────────

const mockUseOrdersList = vi.fn();
const mockDeleteMutateAsync = vi.fn();
const mockSendMutateAsync = vi.fn();
const mockDuplicateMutateAsync = vi.fn();

vi.mock('@/hooks/useOrders', () => ({
  useOrdersList: (...args: unknown[]) => mockUseOrdersList(...args),
  useDeleteOrder: vi.fn(() => ({ mutateAsync: mockDeleteMutateAsync })),
  useDuplicateOrder: vi.fn(() => ({ mutateAsync: mockDuplicateMutateAsync })),
  useSendOrder: vi.fn(() => ({ mutateAsync: mockSendMutateAsync, isPending: false })),
}));

vi.mock('@/api/orders.api', () => ({
  exportOrdersCsv: vi.fn().mockResolvedValue(new Blob(['csv'], { type: 'text/csv' })),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildPaginatedOrders(items = [buildOrder()]): PaginatedOrders {
  return { items, total: items.length, page: 1, limit: 20, totalPages: 1 };
}

function renderPage() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <OrdersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('OrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOrdersList.mockReturnValue({ data: buildPaginatedOrders(), isLoading: false });
  });

  it('renders list view with the orders table', () => {
    renderPage();

    expect(screen.getByTestId('order-filters')).toBeInTheDocument();
    expect(screen.getByTestId('orders-table')).toBeInTheDocument();
    // The order from buildPaginatedOrders should appear
    expect(screen.getByTestId('view-detail-1')).toBeInTheDocument();
  });

  it('"New Order" button switches to form tab', async () => {
    renderPage();

    await userEvent.click(screen.getByTestId('new-order-btn'));

    // Form tab is active (not hidden); list wrapper is CSS-hidden but still in DOM
    expect(screen.getByTestId('chartering-form').closest('.hidden')).toBeNull();
    expect(screen.getByTestId('orders-table').closest('.hidden')).not.toBeNull();
    // Tab label "New Order" appears outside any .hidden wrapper (visible in the tab bar)
    expect(screen.getAllByText('New Order').some(el => !el.closest('.hidden'))).toBe(true);
  });

  it('keyboard shortcut N opens form tab when not in an input', () => {
    renderPage();

    // The page is in list view initially
    expect(screen.getByTestId('orders-table')).toBeInTheDocument();

    // Fire 'N' keydown on the document body
    fireEvent.keyDown(document.body, { key: 'N' });

    expect(screen.getByTestId('chartering-form').closest('.hidden')).toBeNull();
    expect(screen.getByTestId('orders-table').closest('.hidden')).not.toBeNull();
  });

  it('View Detail button switches to detail tab', async () => {
    renderPage();

    await userEvent.click(screen.getByTestId('view-detail-1'));

    expect(screen.getByTestId('order-detail').closest('.hidden')).toBeNull();
    expect(screen.getByTestId('orders-table').closest('.hidden')).not.toBeNull();
    // Detail tab shows the order number
    expect(screen.getByText('BGR1')).toBeInTheDocument();
  });

  it('search filter change calls useOrdersList with updated params', async () => {
    renderPage();

    await userEvent.type(screen.getByTestId('search-input'), 'ABC');

    // After typing, the hook is re-called with filters that include the search term
    const calls = mockUseOrdersList.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[2]).toMatchObject({ search: 'ABC' });
  });

  it('Export CSV button calls exportOrdersCsv and triggers download', async () => {
    const { exportOrdersCsv } = await import('@/api/orders.api');
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);

    renderPage();

    await userEvent.click(screen.getByTestId('export-btn'));

    await waitFor(() => {
      expect(exportOrdersCsv).toHaveBeenCalled();
    });

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  it('shows export error toast when exportOrdersCsv fails', async () => {
    const { exportOrdersCsv } = await import('@/api/orders.api');
    vi.mocked(exportOrdersCsv).mockRejectedValue(new Error('Network error'));

    renderPage();

    await userEvent.click(screen.getByTestId('export-btn'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Export failed', variant: 'destructive' }),
      );
    });
  });

  it('clicking delete on an order opens the delete confirm dialog', async () => {
    renderPage();

    await userEvent.click(screen.getByTestId('delete-1'));

    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-title')).toHaveTextContent('Delete Order');
  });

  it('confirming delete calls deleteOrder and closes dialog', async () => {
    mockDeleteMutateAsync.mockResolvedValue(undefined);

    renderPage();

    await userEvent.click(screen.getByTestId('delete-1'));
    await userEvent.click(screen.getByTestId('confirm-btn'));

    await waitFor(() => {
      expect(mockDeleteMutateAsync).toHaveBeenCalledWith(1);
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });
  });

  it('cancelling delete closes dialog without calling deleteOrder', async () => {
    renderPage();

    await userEvent.click(screen.getByTestId('delete-1'));
    await userEvent.click(screen.getByTestId('cancel-btn'));

    expect(mockDeleteMutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });

  it('shows error toast when delete fails with non-business error', async () => {
    mockDeleteMutateAsync.mockRejectedValue(new Error('server_error'));

    renderPage();

    await userEvent.click(screen.getByTestId('delete-1'));
    await userEvent.click(screen.getByTestId('confirm-btn'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to delete order', variant: 'destructive' }),
      );
    });
  });

  it('shows business error toast when delete fails with Only DRAFT message', async () => {
    mockDeleteMutateAsync.mockRejectedValue({
      response: { data: { error: 'Order must be cancelled or completed before it can be deleted.' } },
    });

    renderPage();

    await userEvent.click(screen.getByTestId('delete-1'));
    await userEvent.click(screen.getByTestId('confirm-btn'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Cannot delete order', variant: 'destructive' }),
      );
    });
  });

  it('clicking send on an order opens the send confirm dialog', async () => {
    renderPage();

    await userEvent.click(screen.getByTestId('send-1'));

    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-title')).toHaveTextContent('Trimiteți comanda?');
  });

  it('confirming send calls sendOrderMutation and closes dialog', async () => {
    mockSendMutateAsync.mockResolvedValue(undefined);

    renderPage();

    await userEvent.click(screen.getByTestId('send-1'));
    await userEvent.click(screen.getByTestId('confirm-btn'));

    await waitFor(() => {
      expect(mockSendMutateAsync).toHaveBeenCalledWith(1);
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });
  });

  it('shows error toast when send fails', async () => {
    mockSendMutateAsync.mockRejectedValue({ response: { data: { error: 'SMTP not configured' } } });

    renderPage();

    await userEvent.click(screen.getByTestId('send-1'));
    await userEvent.click(screen.getByTestId('confirm-btn'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to send order', variant: 'destructive' }),
      );
    });
  });

  it('pagination next page change updates page state', async () => {
    renderPage();

    await userEvent.click(screen.getByTestId('next-page'));

    await waitFor(() => {
      const calls = mockUseOrdersList.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toBe(2);
    });
  });

  it('limit change resets to page 1', async () => {
    renderPage();

    await userEvent.click(screen.getByTestId('change-limit'));

    await waitFor(() => {
      const calls = mockUseOrdersList.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toBe(50);
      expect(lastCall[0]).toBe(1);
    });
  });

  it('sort change updates sortBy and sortOrder', async () => {
    renderPage();

    await userEvent.click(screen.getByTestId('sort-btn'));

    await waitFor(() => {
      const calls = mockUseOrdersList.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[2]).toMatchObject({ sortBy: 'orderNumber', sortOrder: 'asc' });
    });
  });

  it('My Shipments tab button returns to list view from form view', async () => {
    renderPage();

    await userEvent.click(screen.getByTestId('new-order-btn'));
    expect(screen.getByTestId('chartering-form')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /my shipments/i }));

    // list wrapper no longer hidden; form tab is still in DOM but its wrapper has 'hidden' class
    expect(screen.getByTestId('orders-table').closest('.hidden')).toBeNull();
    expect(screen.queryByTestId('chartering-form')!.closest('.hidden')).not.toBeNull();
  });

  it('closing form from detail origin returns to detail view', async () => {
    renderPage();

    // Navigate to detail first
    await userEvent.click(screen.getByTestId('view-detail-1'));
    expect(screen.getByTestId('order-detail')).toBeInTheDocument();

    // Close detail (back to list)
    await userEvent.click(screen.getByRole('button', { name: /my shipments/i }));
    expect(screen.getByTestId('orders-table')).toBeInTheDocument();
  });
});
