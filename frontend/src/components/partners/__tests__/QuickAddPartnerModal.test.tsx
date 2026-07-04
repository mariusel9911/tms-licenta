import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/__tests__/helpers/query-client';
import { QuickAddPartnerModal } from '@/components/partners/QuickAddPartnerModal';
import { buildPartner } from '@/__tests__/helpers/factories';

// ── Hoisted mocks ──────────────────────────────────────────────────────────────

const mockMutateAsync = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/usePartners', () => ({
  useCreatePartner: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock CountryDropdown
vi.mock('@/components/ui/country-dropdown', () => ({
  CountryDropdown: React.forwardRef<HTMLInputElement, { value: string; onChange: (v: string) => void }>(
    ({ value, onChange }, ref) => (
      <input
        ref={ref}
        data-testid="country-dropdown"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Select country"
      />
    ),
  ),
}));

// Mock PhoneInput
vi.mock('@/components/ui/phone-input', () => ({
  PhoneInput: React.forwardRef<HTMLInputElement, { value: string; onChange: (v: string) => void; placeholder?: string }>(
    ({ value, onChange, placeholder }, ref) => (
      <input
        ref={ref}
        data-testid="phone-input"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    ),
  ),
}));

// Mock ViesLookup
vi.mock('@/components/partners/ViesLookup', () => ({
  ViesLookup: ({ vatValue, onVatChange }: { vatValue: string; onVatChange: (v: string) => void }) => (
    <input
      data-testid="vies-input"
      value={vatValue}
      onChange={(e) => onVatChange(e.target.value)}
      placeholder="Fiscal code"
    />
  ),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────────

function renderModal(props: Partial<React.ComponentProps<typeof QuickAddPartnerModal>> = {}) {
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
        <QuickAddPartnerModal {...defaultProps} />
      </QueryClientProvider>,
    ),
    ...defaultProps,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────────

describe('QuickAddPartnerModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue(buildPartner({ id: 99, name: 'New Partner' }));
  });

  it('renders the dialog when open', () => {
    renderModal();
    expect(screen.getByText('Quick Add Partner')).toBeInTheDocument();
  });

  it('does not render the dialog when closed', () => {
    renderModal({ open: false });
    expect(screen.queryByText('Quick Add Partner')).not.toBeInTheDocument();
  });

  it('calls onCreated with the new partner on successful submit', async () => {
    const { onCreated } = renderModal();

    // Fill required fields
    await userEvent.type(screen.getByTestId('country-dropdown'), 'Romania');
    await userEvent.type(screen.getByTestId('vies-input'), 'RO12345');
    await userEvent.type(screen.getByPlaceholderText('Company name'), 'New Partner');
    await userEvent.type(screen.getByPlaceholderText('Street address'), 'Str. Test 1');
    await userEvent.type(screen.getByTestId('phone-input'), '+40712345678');
    await userEvent.type(screen.getByPlaceholderText('contact@company.com'), 'test@test.ro');

    // Submit the modal form
    const form = screen.getByPlaceholderText('Company name').closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(
        expect.objectContaining({ id: 99, name: 'New Partner' }),
      );
    });
  });

  it('shows error toast when creation fails', async () => {
    mockMutateAsync.mockRejectedValue(new Error('fail'));

    renderModal();

    await userEvent.type(screen.getByTestId('country-dropdown'), 'Romania');
    await userEvent.type(screen.getByTestId('vies-input'), 'RO12345');
    await userEvent.type(screen.getByPlaceholderText('Company name'), 'Fail Partner');
    await userEvent.type(screen.getByPlaceholderText('Street address'), 'Str. Fail 1');
    await userEvent.type(screen.getByTestId('phone-input'), '+40712345678');
    await userEvent.type(screen.getByPlaceholderText('contact@company.com'), 'fail@test.ro');

    const form = screen.getByPlaceholderText('Company name').closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to create partner', variant: 'destructive' }),
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
    // This test verifies the core bug fix: the QuickAddPartnerModal's form
    // submit must NOT bubble through React's portal tree to the parent form.
    const parentSubmitHandler = vi.fn();
    const queryClient = createTestQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <form onSubmit={parentSubmitHandler} data-testid="parent-form">
          <QuickAddPartnerModal
            open={true}
            onClose={vi.fn()}
            onCreated={vi.fn()}
          />
        </form>
      </QueryClientProvider>,
    );

    // Fill required fields
    await userEvent.type(screen.getByTestId('country-dropdown'), 'Romania');
    await userEvent.type(screen.getByTestId('vies-input'), 'RO12345');
    await userEvent.type(screen.getByPlaceholderText('Company name'), 'Bubble Test');
    await userEvent.type(screen.getByPlaceholderText('Street address'), 'Str. Bubble 1');
    await userEvent.type(screen.getByTestId('phone-input'), '+40712345678');
    await userEvent.type(screen.getByPlaceholderText('contact@company.com'), 'bubble@test.ro');

    // Submit the modal form
    const modalForm = screen.getByPlaceholderText('Company name').closest('form')!;
    fireEvent.submit(modalForm);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });

    // The parent form's submit handler must NOT have been called
    expect(parentSubmitHandler).not.toHaveBeenCalled();
  });
});
