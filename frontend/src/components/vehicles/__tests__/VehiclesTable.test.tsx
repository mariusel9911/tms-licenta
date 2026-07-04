import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VehiclesTable } from '@/components/vehicles/VehiclesTable';
import { buildVehicle } from '@/__tests__/helpers/factories';
import { useAuthStore } from '@/store/auth.store';

const defaultHandlers = {
  onEdit: vi.fn(),
  onDelete: vi.fn(),
};

const adminUser = { id: 1, name: 'Admin', email: 'admin@test.ro', role: 'ADMIN' as const, isSystemAdmin: false };
const dispatcherUser = { id: 2, name: 'Dispatcher', email: 'dispatcher@test.ro', role: 'DISPATCHER' as const, isSystemAdmin: false };

describe('VehiclesTable', () => {
  const initialState = useAuthStore.getState();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ ...initialState, user: adminUser });
  });

  it('renders vehicle rows with correct data', () => {
    const vehicles = [
      buildVehicle({ id: 1, licensePlate: 'TM01ABC', make: 'Mercedes', model: 'Actros', status: 'AVAILABLE' }),
      buildVehicle({ id: 2, licensePlate: 'B99XYZ', make: 'Volvo', model: 'FH16', status: 'ON_ROUTE' }),
    ];
    render(<VehiclesTable data={vehicles} isLoading={false} {...defaultHandlers} />);

    expect(screen.getByText('TM01ABC')).toBeInTheDocument();
    expect(screen.getByText('Mercedes Actros')).toBeInTheDocument();
    expect(screen.getByText('B99XYZ')).toBeInTheDocument();
  });

  it('renders status badge with correct variant for each status', () => {
    const available = buildVehicle({ status: 'AVAILABLE' });
    const maintenance = buildVehicle({ id: 2, licensePlate: 'B02DEF', status: 'MAINTENANCE' });
    render(<VehiclesTable data={[available, maintenance]} isLoading={false} {...defaultHandlers} />);

    const availableBadge = screen.getByText('Available');
    expect(availableBadge).toHaveClass('bg-green-100');

    const maintenanceBadge = screen.getByText('Maintenance');
    expect(maintenanceBadge).toHaveClass('bg-amber-100');
  });

  it('calls onEdit with the vehicle when the edit button is clicked', async () => {
    const vehicle = buildVehicle({ id: 1 });
    render(<VehiclesTable data={[vehicle]} isLoading={false} {...defaultHandlers} />);

    await userEvent.click(screen.getByTitle('Edit vehicle'));
    expect(defaultHandlers.onEdit).toHaveBeenCalledWith(vehicle);
  });

  it('calls onDelete with the vehicle id when the delete button is clicked (ADMIN)', async () => {
    const vehicle = buildVehicle({ id: 55, licensePlate: 'DEL01' });
    render(<VehiclesTable data={[vehicle]} isLoading={false} {...defaultHandlers} />);

    await userEvent.click(screen.getByTitle('Delete vehicle'));
    expect(defaultHandlers.onDelete).toHaveBeenCalledWith(55);
  });

  it('shows empty state when no vehicles exist', () => {
    render(<VehiclesTable data={[]} isLoading={false} {...defaultHandlers} />);
    expect(screen.getByText('No vehicles found')).toBeInTheDocument();
  });

  it('hides delete button for DISPATCHER role', () => {
    useAuthStore.setState({ ...initialState, user: dispatcherUser });
    const vehicle = buildVehicle({ id: 1, licensePlate: 'TM01ABC' });
    render(<VehiclesTable data={[vehicle]} isLoading={false} {...defaultHandlers} />);

    expect(screen.queryByTitle('Delete vehicle')).not.toBeInTheDocument();
    expect(screen.getByTitle('Edit vehicle')).toBeInTheDocument();
  });

  it('shows delete button for ADMIN role', () => {
    const vehicle = buildVehicle({ id: 1, licensePlate: 'TM01ABC' });
    render(<VehiclesTable data={[vehicle]} isLoading={false} {...defaultHandlers} />);

    expect(screen.getByTitle('Delete vehicle')).toBeInTheDocument();
  });
});
