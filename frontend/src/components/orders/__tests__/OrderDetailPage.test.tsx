import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrderDetailPage } from '@/components/orders/OrderDetailPage';
import { buildOrder, buildAuthUser } from '@/__tests__/helpers/factories';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('react-circle-flags', () => ({
  CircleFlag: ({ countryCode }: { countryCode: string }) => (
    <span data-testid={`flag-${countryCode}`} />
  ),
}));

const mockPreviewPdfMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock('@/hooks/useOrders', () => ({
  useOrder: vi.fn((_id: number) => ({
    data: _mockOrder,
    isLoading: false,
  })),
  useOrdersList: vi.fn(() => ({ data: undefined })),
  usePreviewOrderPdf: vi.fn(() => ({
    mutateAsync: mockPreviewPdfMutateAsync,
    isPending: false,
  })),
  useSendOrder: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useDownloadOrderPdf: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateOrder: vi.fn(() => ({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })),
}));

vi.mock('@/hooks/useActivity', () => ({
  useOrderActivity: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

vi.mock('@/store/auth.store', () => ({
  useAuthStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ user: buildAuthUser() }),
  ),
}));

// ConfirmDialog — render as a passthrough so send button interactions work
vi.mock('@/components/common/ConfirmDialog', () => ({
  ConfirmDialog: ({ open, onCancel }: { open: boolean; onCancel: () => void }) =>
    open ? <button onClick={onCancel}>Cancel</button> : null,
}));

vi.mock('@/components/orders/OrderStatusSelect', () => ({
  OrderStatusSelect: () => <div data-testid="status-select" />,
}));

vi.mock('@/components/orders/OrderActivityLog', () => ({
  OrderActivityLog: () => <div data-testid="activity-log" />,
}));

// ---------------------------------------------------------------------------
// navigator.clipboard — must be at module level (jsdom doesn't define it)
// ---------------------------------------------------------------------------

const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: mockWriteText },
  writable: true,
  configurable: true,
});

// ---------------------------------------------------------------------------
// Module-level order variable (mutated per test via _mockOrder)
// ---------------------------------------------------------------------------

let _mockOrder = buildOrder();

// Keep useOrder returning the current _mockOrder
import { useOrder } from '@/hooks/useOrders';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultHandlers = {
  onEdit: vi.fn(),
  onDuplicate: vi.fn(),
  onDelete: vi.fn(),
  onBack: vi.fn(),
};

function renderPage() {
  return render(<OrderDetailPage orderId={1} {...defaultHandlers} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrderDetailPage — Internal Notes card', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders internal notes when internalNotes is set', () => {
    _mockOrder = buildOrder({ internalNotes: 'Driver prefers dock #3' });
    (useOrder as ReturnType<typeof vi.fn>).mockReturnValue({ data: _mockOrder, isLoading: false });

    renderPage();

    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Driver prefers dock #3')).toBeInTheDocument();
  });

  it('shows placeholder when internalNotes is null', () => {
    _mockOrder = buildOrder({ internalNotes: null });
    (useOrder as ReturnType<typeof vi.fn>).mockReturnValue({ data: _mockOrder, isLoading: false });

    renderPage();

    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('No internal notes.')).toBeInTheDocument();
  });

  it('renders CopyButton when internalNotes is set and copies text on click', async () => {
    _mockOrder = buildOrder({ internalNotes: 'Driver prefers dock #3' });
    (useOrder as ReturnType<typeof vi.fn>).mockReturnValue({ data: _mockOrder, isLoading: false });
    mockWriteText.mockClear();

    renderPage();

    const copyBtn = screen.getByRole('button', { name: /^copy$/i });
    expect(copyBtn).toBeInTheDocument();

    await userEvent.click(copyBtn);

    expect(mockWriteText).toHaveBeenCalledWith('Driver prefers dock #3');
  });

  it('does not render CopyButton when internalNotes is null', () => {
    _mockOrder = buildOrder({ internalNotes: null });
    (useOrder as ReturnType<typeof vi.fn>).mockReturnValue({ data: _mockOrder, isLoading: false });

    renderPage();

    expect(screen.queryByRole('button', { name: /^copy$/i })).not.toBeInTheDocument();
  });
});

describe('OrderDetailPage — additional address rows', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders additional loading and delivery stops in the Route card', () => {
    _mockOrder = buildOrder({
      additionalPickupsJson: JSON.stringify([{ address: 'Second Loading Point', country: 'Spain' }]),
      additionalDeliveriesJson: JSON.stringify([{ address: 'Second Delivery Point', country: 'Germany' }]),
    });
    (useOrder as ReturnType<typeof vi.fn>).mockReturnValue({ data: _mockOrder, isLoading: false });

    renderPage();

    expect(screen.getByText('Second Loading Point')).toBeInTheDocument();
    expect(screen.getByText('Second Delivery Point')).toBeInTheDocument();
    expect(screen.getByText('Loading 2')).toBeInTheDocument();
    expect(screen.getByText('Delivery 2')).toBeInTheDocument();
  });

  it('does not render extra address sections when both JSON fields are null', () => {
    _mockOrder = buildOrder({ additionalPickupsJson: null, additionalDeliveriesJson: null });
    (useOrder as ReturnType<typeof vi.fn>).mockReturnValue({ data: _mockOrder, isLoading: false });

    renderPage();

    expect(screen.queryByText('Loading 2')).not.toBeInTheDocument();
    expect(screen.queryByText('Delivery 2')).not.toBeInTheDocument();
  });
});

describe('OrderDetailPage — View PDF does not include internalNotes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls previewPdf WITHOUT internalNotes in the DTO', async () => {
    _mockOrder = buildOrder({
      internalNotes: 'SECRET',
      additionalPickupsJson: null,
      additionalDeliveriesJson: null,
    });
    (useOrder as ReturnType<typeof vi.fn>).mockReturnValue({ data: _mockOrder, isLoading: false });

    renderPage();

    const viewPdfBtn = screen.getByRole('button', { name: /View PDF/i });
    await userEvent.click(viewPdfBtn);

    expect(mockPreviewPdfMutateAsync).toHaveBeenCalledWith(
      expect.not.objectContaining({ internalNotes: expect.anything() }),
    );
  });
});
