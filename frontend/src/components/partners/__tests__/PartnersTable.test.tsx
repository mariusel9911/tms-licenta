import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PartnersTable } from '@/components/partners/PartnersTable';
import { buildPartner } from '@/__tests__/helpers/factories';
import { useAuthStore } from '@/store/auth.store';

const defaultHandlers = {
  onEdit: vi.fn(),
  onDelete: vi.fn(),
};

const adminUser = { id: 1, name: 'Admin', email: 'admin@test.ro', role: 'ADMIN' as const, isSystemAdmin: false };
const dispatcherUser = { id: 2, name: 'Dispatcher', email: 'dispatcher@test.ro', role: 'DISPATCHER' as const, isSystemAdmin: false };

describe('PartnersTable', () => {
  const initialState = useAuthStore.getState();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ ...initialState, user: adminUser });
  });

  it('renders partner rows with correct data', () => {
    const partners = [
      buildPartner({ id: 1, name: 'Acme SRL', email: 'acme@test.ro', fiscalCode: 'RO1111' }),
      buildPartner({ id: 2, name: 'Beta SRL', email: 'beta@test.ro', fiscalCode: 'RO2222' }),
    ];
    render(<PartnersTable data={partners} isLoading={false} {...defaultHandlers} />);

    expect(screen.getByText('Acme SRL')).toBeInTheDocument();
    expect(screen.getByText('acme@test.ro')).toBeInTheDocument();
    expect(screen.getByText('RO1111')).toBeInTheDocument();
    expect(screen.getByText('Beta SRL')).toBeInTheDocument();
  });

  it('shows empty state when no partners exist', () => {
    render(<PartnersTable data={[]} isLoading={false} {...defaultHandlers} />);
    expect(screen.getByText('No partners found')).toBeInTheDocument();
  });

  it('calls onEdit with the partner when the edit button is clicked', async () => {
    const partner = buildPartner({ id: 1, name: 'Test Partner' });
    render(<PartnersTable data={[partner]} isLoading={false} {...defaultHandlers} />);

    await userEvent.click(screen.getByTitle('Edit partner'));
    expect(defaultHandlers.onEdit).toHaveBeenCalledWith(partner);
  });

  it('calls onDelete with the partner id when the delete button is clicked (ADMIN)', async () => {
    const partner = buildPartner({ id: 42, name: 'Delete Me' });
    render(<PartnersTable data={[partner]} isLoading={false} {...defaultHandlers} />);

    await userEvent.click(screen.getByTitle('Delete partner'));
    expect(defaultHandlers.onDelete).toHaveBeenCalledWith(42);
  });

  it('shows loading skeleton when isLoading is true', () => {
    const { container } = render(
      <PartnersTable data={[]} isLoading={true} {...defaultHandlers} />,
    );
    // TableSkeleton renders a div with child row divs — no table element
    expect(container.querySelector('table')).not.toBeInTheDocument();
    expect(screen.queryByText('No partners found')).not.toBeInTheDocument();
  });

  it('hides delete button for DISPATCHER role', () => {
    useAuthStore.setState({ ...initialState, user: dispatcherUser });
    const partner = buildPartner({ id: 1, name: 'Acme SRL' });
    render(<PartnersTable data={[partner]} isLoading={false} {...defaultHandlers} />);

    expect(screen.queryByTitle('Delete partner')).not.toBeInTheDocument();
    expect(screen.getByTitle('Edit partner')).toBeInTheDocument();
  });

  it('shows delete button for ADMIN role', () => {
    const partner = buildPartner({ id: 1, name: 'Acme SRL' });
    render(<PartnersTable data={[partner]} isLoading={false} {...defaultHandlers} />);

    expect(screen.getByTitle('Delete partner')).toBeInTheDocument();
  });
});
