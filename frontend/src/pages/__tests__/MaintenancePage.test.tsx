import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ─── Hoisted mocks ───────────────────────────────────────────────────────────
const { mockNavigate, mockUseMaintenanceStatus } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockUseMaintenanceStatus: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>();
  return { ...mod, useNavigate: () => mockNavigate };
});

vi.mock('@/hooks/useSettings', () => ({
  useMaintenanceStatus: mockUseMaintenanceStatus,
}));

import MaintenancePage from '@/pages/MaintenancePage';

beforeEach(() => {
  vi.clearAllMocks();
  // Default: maintenance is ON with no custom message
  mockUseMaintenanceStatus.mockReturnValue({ data: { enabled: true, message: '' } });
});

describe('MaintenancePage', () => {
  it('renders the "Under Maintenance" heading', () => {
    render(<MaintenancePage />);
    expect(screen.getByRole('heading', { name: /under maintenance/i })).toBeInTheDocument();
  });

  it('shows the custom server message when provided', () => {
    mockUseMaintenanceStatus.mockReturnValue({
      data: { enabled: true, message: 'Back in 10 minutes' },
    });
    render(<MaintenancePage />);
    expect(screen.getByText('Back in 10 minutes')).toBeInTheDocument();
  });

  it('shows the default fallback text when message is empty', () => {
    render(<MaintenancePage />); // default: enabled=true, message=''
    expect(screen.getByText(/performing scheduled maintenance/i)).toBeInTheDocument();
  });

  it('does NOT navigate when maintenance is still enabled', () => {
    render(<MaintenancePage />);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates to /login when maintenance becomes disabled (enabled=false)', () => {
    mockUseMaintenanceStatus.mockReturnValue({ data: { enabled: false, message: '' } });
    render(<MaintenancePage />);
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('does NOT navigate when data is undefined (still loading)', () => {
    mockUseMaintenanceStatus.mockReturnValue({ data: undefined });
    render(<MaintenancePage />);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('renders the polling indicator', () => {
    render(<MaintenancePage />);
    expect(screen.getByText(/checking status/i)).toBeInTheDocument();
  });
});
