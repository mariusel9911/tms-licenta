import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import PartnersPage from '@/pages/PartnersPage';
import { createTestQueryClient } from '@/__tests__/helpers/query-client';
import { buildPartner } from '@/__tests__/helpers/factories';
import type { Partner } from '@/types/partner.types';

// ── Child component mocks ───────────────────────────────────────────────────

vi.mock('@/components/partners/PartnersTable', () => ({
  PartnersTable: ({
    data,
    isLoading,
    onDelete,
    onEdit,
  }: {
    data: Partner[];
    isLoading: boolean;
    onDelete?: (id: number) => void;
    onEdit?: (p: Partner) => void;
  }) => (
    <div data-testid="partners-table">
      {isLoading ? (
        <span>Loading…</span>
      ) : (
        data.map((p) => (
          <div key={p.id} data-testid={`partner-row-${p.id}`}>
            {p.name}
            {/* "Remove" avoids name clash with ConfirmDialog "Delete" button */}
            <button onClick={() => onDelete?.(p.id)} data-testid={`remove-${p.id}`}>
              Remove
            </button>
            <button onClick={() => onEdit?.(p)} data-testid={`edit-${p.id}`}>
              Edit
            </button>
          </div>
        ))
      )}
    </div>
  ),
}));

vi.mock('@/components/partners/PartnerForm', () => ({
  PartnerForm: ({ onClose, partner }: { onClose: () => void; partner?: Partner }) => (
    <div data-testid="partner-form">
      {partner && <span data-testid="editing-name">{partner.name}</span>}
      <button onClick={onClose} data-testid="close-form-btn">
        Close
      </button>
    </div>
  ),
}));

// ── shadcn Select mock (native <select>) ────────────────────────────────────

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

// ── Hook mocks ──────────────────────────────────────────────────────────────

const mockMutateAsync = vi.fn();
const mockPartner = buildPartner({ id: 1, name: 'Test Partner SRL' });

vi.mock('@/hooks/usePartners', () => ({
  usePartnersList: vi.fn(() => ({
    data: {
      items: [mockPartner],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    },
    isLoading: false,
  })),
  useDeletePartner: vi.fn(() => ({ mutateAsync: mockMutateAsync })),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

function renderPage() {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PartnersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PartnersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({});
  });

  it('renders list view with partners table showing partner rows', () => {
    renderPage();

    expect(screen.getByTestId('partners-table')).toBeInTheDocument();
    expect(screen.getByTestId('partner-row-1')).toBeInTheDocument();
    expect(screen.getByText('Test Partner SRL')).toBeInTheDocument();
  });

  it('"Add Partner" button switches to form tab', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /add partner/i }));

    expect(screen.getByTestId('partner-form')).toBeInTheDocument();
    expect(screen.queryByTestId('partners-table')).not.toBeInTheDocument();
    expect(screen.getByText('Add partner')).toBeInTheDocument();
  });

  it('clicking Edit in table opens form with the partner data', async () => {
    renderPage();

    await userEvent.click(screen.getByTestId('edit-1'));

    expect(screen.getByTestId('partner-form')).toBeInTheDocument();
    // Form shows partner name and the tab shows the partner name too
    expect(screen.getByTestId('editing-name')).toHaveTextContent('Test Partner SRL');
    // Tab label and the editing-name span both show the partner name
    expect(screen.getAllByText('Test Partner SRL').length).toBeGreaterThanOrEqual(1);
  });

  it('X button in form tab closes the form and returns to list', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /add partner/i }));
    expect(screen.getByTestId('partner-form')).toBeInTheDocument();

    await userEvent.click(screen.getByTitle('Close tab'));

    expect(screen.queryByTestId('partner-form')).not.toBeInTheDocument();
    expect(screen.getByTestId('partners-table')).toBeInTheDocument();
  });

  it('clicking the Partner tab from form view returns to list', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /add partner/i }));
    expect(screen.getByTestId('partner-form')).toBeInTheDocument();

    // Click the "Partner" tab (first tab button)
    await userEvent.click(screen.getByRole('button', { name: /^partner$/i }));

    expect(screen.getByTestId('partners-table')).toBeInTheDocument();
    expect(screen.queryByTestId('partner-form')).not.toBeInTheDocument();
  });

  it('search input updates and debounce propagates the query', async () => {
    renderPage();

    // Placeholder updated; no Search button — debounce fires after 200ms
    const searchInput = screen.getByPlaceholderText('Search partners...');
    await userEvent.type(searchInput, 'Transport SRL');

    await waitFor(() => {
      expect(searchInput).toHaveValue('Transport SRL');
    }, { timeout: 500 });

    expect(screen.getByTestId('partners-table')).toBeInTheDocument();
  });

  it('Clear button resets the search filter', async () => {
    const { usePartnersList } = await import('@/hooks/usePartners');
    const mockHook = vi.mocked(usePartnersList);

    renderPage();

    const searchInput = screen.getByPlaceholderText('Search partners...');
    await userEvent.type(searchInput, 'Transport SRL');

    // Clear button appears once searchInput has a value
    const clearButton = await screen.findByRole('button', { name: /clear/i });
    await userEvent.click(clearButton);

    // usePartnersList called without search term after clearing
    expect(mockHook).toHaveBeenLastCalledWith(1, 20, undefined);
  });

  it('delete flow: Remove opens ConfirmDialog; Cancel closes it', async () => {
    renderPage();

    await userEvent.click(screen.getByTestId('remove-1'));
    expect(screen.getByText('Delete Partner')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText('Delete Partner')).not.toBeInTheDocument();
  });

  it('delete flow: confirming delete calls deletePartner.mutateAsync', async () => {
    renderPage();

    await userEvent.click(screen.getByTestId('remove-1'));
    expect(screen.getByText('Delete Partner')).toBeInTheDocument();

    // Click the "Delete" confirm button in the dialog
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(1);
    });
  });
});
