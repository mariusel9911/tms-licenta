import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CharteringAgreementForm } from '@/components/orders/CharteringAgreementForm';
import { buildOrder } from '@/__tests__/helpers/factories';

// ---------------------------------------------------------------------------
// Mocks (minimal — only what the component strictly imports)
// ---------------------------------------------------------------------------

const mockCreateMutateAsync = vi.fn().mockResolvedValue(
  buildOrder({ id: 99, orderNumber: 'BGR99' }),
);
const mockUpdateMutateAsync = vi.fn().mockResolvedValue(
  buildOrder({ id: 1, orderNumber: 'BGR1' }),
);
const mockPreviewMutateAsync = vi.fn().mockResolvedValue(undefined);

vi.mock('@/hooks/useOrders', () => ({
  useCreateOrder: vi.fn(() => ({ mutateAsync: mockCreateMutateAsync, isPending: false })),
  useUpdateOrder: vi.fn(() => ({ mutateAsync: mockUpdateMutateAsync, isPending: false })),
  usePreviewOrderPdf: vi.fn(() => ({ mutateAsync: mockPreviewMutateAsync, isPending: false })),
  useOrdersList: vi.fn(() => ({ data: undefined })),
}));

vi.mock('@/hooks/usePartners', () => ({
  usePartnersList: vi.fn(() => ({ data: { items: [], total: 0 } })),
  usePartner: vi.fn(() => ({ data: undefined })),
}));

vi.mock('@/hooks/useVehicles', () => ({
  useVehiclesList: vi.fn(() => ({ data: { items: [], total: 0 } })),
  useVehicle: vi.fn(() => ({ data: undefined })),
}));

vi.mock('@/hooks/useSettings', () => ({
  useSettings: vi.fn(() => ({ data: { companyName: 'Test Co', companyStampPath: null } })),
}));

vi.mock('@/hooks/useDebounce', () => ({
  useDebounce: vi.fn((val: string) => val),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

vi.mock('@/components/partners/QuickAddPartnerModal', () => ({
  QuickAddPartnerModal: () => null,
}));

vi.mock('@/components/vehicles/QuickAddVehicleModal', () => ({
  QuickAddVehicleModal: () => null,
}));

// CountryDropdown — render as a simple select
vi.mock('@/components/ui/country-dropdown', () => ({
  CountryDropdown: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <select
      aria-label="country"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// DateTimePickerField — render as a plain input
vi.mock('@/components/ui/date-time-picker-field', () => ({
  DateTimePickerField: ({
    value,
    onChange,
    id,
  }: {
    value: string;
    onChange: (v: string) => void;
    id?: string;
  }) => (
    <input
      id={id}
      aria-label={id ?? 'datetime'}
      type="datetime-local"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// Popover + Command — flat passthrough so comboboxes are queryable
vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/command', () => ({
  Command: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandInput: () => null,
  CommandList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandEmpty: () => null,
  CommandGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandItem: ({ children, onSelect }: { children: React.ReactNode; onSelect: () => void }) => (
    <div onClick={onSelect}>{children}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderForm(order?: ReturnType<typeof buildOrder>) {
  return render(
    <CharteringAgreementForm
      order={order}
      onClose={vi.fn()}
    />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CharteringAgreementForm — additional address buttons', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders "Add Loading Address" and "Add Delivery Address" buttons', () => {
    renderForm();
    expect(screen.getByRole('button', { name: /Add Loading Address/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Delivery Address/i })).toBeInTheDocument();
  });

  it('clicking "Add Loading Address" shows a new loading address card', async () => {
    renderForm();
    const addBtn = screen.getByRole('button', { name: /Add Loading Address/i });
    await userEvent.click(addBtn);
    expect(screen.getByText('Loading Address 2')).toBeInTheDocument();
  });

  it('clicking "Add Delivery Address" shows a new delivery address card', async () => {
    renderForm();
    const addBtn = screen.getByRole('button', { name: /Add Delivery Address/i });
    await userEvent.click(addBtn);
    expect(screen.getByText('Delivery Address 2')).toBeInTheDocument();
  });

  it('remove button removes the added loading address card', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: /Add Loading Address/i }));
    expect(screen.getByText('Loading Address 2')).toBeInTheDocument();

    // Find the × button in the card using the card heading
    const cardSection = screen.getByText('Loading Address 2').closest('div')!;
    const xBtn = cardSection.parentElement!.querySelector('button')!;
    await userEvent.click(xBtn);

    expect(screen.queryByText('Loading Address 2')).not.toBeInTheDocument();
  });

  it('prefills additional pickups from order.additionalPickupsJson in edit mode', () => {
    const order = buildOrder({
      additionalPickupsJson: JSON.stringify([
        { address: 'Pre-filled Pickup', country: 'Italy', dateBegin: '' },
      ]),
    });
    renderForm(order);
    expect(screen.getByText('Loading Address 2')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Pre-filled Pickup')).toBeInTheDocument();
  });

  it('prefills additional deliveries from order.additionalDeliveriesJson in edit mode', () => {
    const order = buildOrder({
      additionalDeliveriesJson: JSON.stringify([
        { address: 'Pre-filled Delivery', country: 'Germany', dateBegin: '' },
      ]),
    });
    renderForm(order);
    expect(screen.getByText('Delivery Address 2')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Pre-filled Delivery')).toBeInTheDocument();
  });
});

describe('CharteringAgreementForm — internalNotes not in form', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does NOT render an Internal Notes / private notes field', () => {
    renderForm();
    expect(screen.queryByText('Internal Notes (private)')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Private notes/i)).not.toBeInTheDocument();
  });
});
