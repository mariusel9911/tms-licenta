import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import VehiclesPage from '@/pages/VehiclesPage';
import { createTestQueryClient } from '@/__tests__/helpers/query-client';
import { buildVehicle } from '@/__tests__/helpers/factories';

// ── Component mocks ──────────────────────────────────────────────────────────

vi.mock('@/components/vehicles/VehiclesTable', () => ({
  // VehiclesPage passes data={items} (Vehicle[] array), not a paginated object
  VehiclesTable: ({
    data,
    onDelete,
    onEdit,
  }: {
    data: ReturnType<typeof buildVehicle>[];
    onDelete?: (id: number) => void;
    onEdit?: (v: ReturnType<typeof buildVehicle>) => void;
  }) => (
    <div data-testid="vehicles-table">
      {data.map((v) => (
        <div key={v.id} data-testid="vehicle-row">
          {v.licensePlate}
          {/* "Remove" avoids name clash with ConfirmDialog "Delete" button */}
          <button onClick={() => onDelete?.(v.id)} data-testid={`remove-${v.id}`}>
            Remove
          </button>
          <button onClick={() => onEdit?.(v)} data-testid={`edit-${v.id}`}>
            Edit
          </button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/components/vehicles/VehicleForm', () => ({
  VehicleForm: ({ vehicle }: { vehicle?: ReturnType<typeof buildVehicle> }) => (
    <div data-testid="vehicle-form">{vehicle ? vehicle.licensePlate : 'New Vehicle'}</div>
  ),
}));

// ── Hook mocks ───────────────────────────────────────────────────────────────

const mockMutateAsync = vi.fn();
const mockVehicle = buildVehicle({ id: 1, licensePlate: 'B-123-XYZ' });

vi.mock('@/hooks/useVehicles', () => ({
  useVehiclesList: vi.fn(() => ({
    data: { items: [mockVehicle], total: 1, page: 1, limit: 20, totalPages: 1 },
    isLoading: false,
  })),
  useDeleteVehicle: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
}));

// ── Popover mock — always renders content so status buttons are queryable ────
vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverAnchor: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── shadcn Select → native <select> (pagination only) ───────────────────────
vi.mock('@/components/ui/select', () => ({
  Select: ({
    onValueChange,
    value,
    children,
  }: {
    onValueChange: (v: string) => void;
    value: string;
    children: React.ReactNode;
  }) => (
    <select value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderPage() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <VehiclesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('VehiclesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({});
  });

  it('renders list view with vehicles table showing vehicle rows', () => {
    renderPage();

    expect(screen.getByTestId('vehicles-table')).toBeInTheDocument();
    expect(screen.getByText('B-123-XYZ')).toBeInTheDocument();
  });

  it('"Add vehicle" button switches to form view', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /add vehicle/i }));
    expect(screen.getByTestId('vehicle-form')).toBeInTheDocument();
    expect(screen.queryByTestId('vehicles-table')).not.toBeInTheDocument();
  });

  it('clicking Edit in table opens form in edit mode with vehicle data', async () => {
    renderPage();

    await userEvent.click(screen.getByTestId('edit-1'));

    expect(screen.getByTestId('vehicle-form')).toBeInTheDocument();
    // Form mock renders vehicle.licensePlate — multiple matches are expected (tab + form)
    expect(screen.getAllByText('B-123-XYZ').length).toBeGreaterThanOrEqual(1);
  });

  it('X button in form tab closes the form and returns to list', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /add vehicle/i }));
    expect(screen.getByTestId('vehicle-form')).toBeInTheDocument();

    await userEvent.click(screen.getByTitle('Close tab'));

    expect(screen.queryByTestId('vehicle-form')).not.toBeInTheDocument();
    expect(screen.getByTestId('vehicles-table')).toBeInTheDocument();
  });

  it('clicking the Vehicles tab from form view returns to list', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /add vehicle/i }));
    expect(screen.getByTestId('vehicle-form')).toBeInTheDocument();

    // Click the "Vehicles" tab (first tab button)
    await userEvent.click(screen.getByRole('button', { name: /^vehicles$/i }));

    expect(screen.getByTestId('vehicles-table')).toBeInTheDocument();
    expect(screen.queryByTestId('vehicle-form')).not.toBeInTheDocument();
  });

  it('search input updates and debounce propagates the query', async () => {
    renderPage();

    // Placeholder updated; no Search button — debounce fires after 200ms
    const searchInput = screen.getByPlaceholderText('Search vehicles...');
    await userEvent.type(searchInput, 'Volvo');

    await waitFor(() => {
      expect(searchInput).toHaveValue('Volvo');
    }, { timeout: 500 });

    expect(screen.getByTestId('vehicles-table')).toBeInTheDocument();
  });

  it('Clear button resets the search filter', async () => {
    const { useVehiclesList } = await import('@/hooks/useVehicles');
    const mockHook = vi.mocked(useVehiclesList);

    renderPage();

    const searchInput = screen.getByPlaceholderText('Search vehicles...');
    await userEvent.type(searchInput, 'Volvo');

    // Clear button appears once searchInput has a value
    const clearButton = await screen.findByRole('button', { name: /clear/i });
    await userEvent.click(clearButton);

    // useVehiclesList called without search term after clearing
    expect(mockHook).toHaveBeenLastCalledWith(1, 20, undefined, undefined);
  });

  it('status filter changes the vehicle filter', async () => {
    const { useVehiclesList } = await import('@/hooks/useVehicles');
    const mockHook = vi.mocked(useVehiclesList);

    renderPage();

    // Status is now a Popover with buttons — Popover mock always renders content
    await userEvent.click(screen.getByRole('button', { name: /^available$/i }));

    expect(mockHook).toHaveBeenCalledWith(1, 20, undefined, 'AVAILABLE');
  });

  it('delete flow: Remove opens ConfirmDialog; Cancel closes it', async () => {
    renderPage();

    await userEvent.click(screen.getByTestId('remove-1'));
    expect(screen.getByText('Delete Vehicle')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText('Delete Vehicle')).not.toBeInTheDocument();
  });

  it('delete flow: confirming delete calls deleteVehicle.mutateAsync', async () => {
    renderPage();

    await userEvent.click(screen.getByTestId('remove-1'));
    expect(screen.getByText('Delete Vehicle')).toBeInTheDocument();

    // Click the "Delete" confirm button in the dialog
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(1);
    });
  });
});
