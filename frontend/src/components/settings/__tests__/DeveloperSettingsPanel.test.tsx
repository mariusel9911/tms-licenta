import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DeveloperSettingsPanel } from '@/components/settings/DeveloperSettingsPanel';

// ── Hoisted mock fns (stable references — prevent useEffect infinite loops) ──
const { mockMutateAsync, mockToast, mockUseSettings, mockUseSystemInfo } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn().mockResolvedValue({}),
  mockToast: vi.fn(),
  mockUseSettings: vi.fn(),
  mockUseSystemInfo: vi.fn(),
}));

// ── Hook mocks ───────────────────────────────────────────────────────────────
vi.mock('@/hooks/useSettings', () => ({
  useSettings: mockUseSettings,
  useSystemInfo: mockUseSystemInfo,
  useUpdateSettings: vi.fn(() => ({ mutateAsync: mockMutateAsync, isPending: false })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: mockToast })),
}));

// ── ConfirmDialog stub ────────────────────────────────────────────────────────
vi.mock('@/components/common/ConfirmDialog', () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
    onCancel,
    title,
  }: {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title: string;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <p>{title}</p>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}));

// ── Default test data ─────────────────────────────────────────────────────────

const defaultSettings = {
  maintenanceEnabled: false,
  maintenanceMessage: '',
  rateLimitEnabled: true,
  rateLimitPerUser: 50,
};

const defaultSystemInfo = {
  uptime: 90061,         // 1d 1h 1m
  nodeVersion: 'v20.0.0',
  databaseSizeBytes: 2097152,  // 2.0 MB
  avgResponseTime: 12.5,
  p95ResponseTime: 45.0,
  requestsPerMinute: 1.67,
  totalRequests: 1000,
  environment: 'development',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockMutateAsync.mockResolvedValue({});
  mockUseSettings.mockReturnValue({ data: defaultSettings, isLoading: false });
  mockUseSystemInfo.mockReturnValue({ data: defaultSystemInfo, isLoading: false });
});

// ── Loading state ─────────────────────────────────────────────────────────────

describe('DeveloperSettingsPanel — loading state', () => {
  it('renders skeleton divs and no maintenance card while isLoading=true', () => {
    mockUseSettings.mockReturnValue({ data: undefined, isLoading: true });
    render(<DeveloperSettingsPanel />);

    // Skeleton renders placeholder divs — no "Maintenance Mode" text
    expect(screen.queryByText('Maintenance Mode')).not.toBeInTheDocument();
  });
});

// ── Maintenance card (maintenance OFF) ───────────────────────────────────────

describe('DeveloperSettingsPanel — maintenance OFF', () => {
  it('shows "Activate Maintenance" button', () => {
    render(<DeveloperSettingsPanel />);
    expect(screen.getByRole('button', { name: /activate maintenance/i })).toBeInTheDocument();
  });

  it('does not show the "Active" badge', () => {
    render(<DeveloperSettingsPanel />);
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });

  it('textarea is enabled', () => {
    render(<DeveloperSettingsPanel />);
    expect(screen.getByPlaceholderText(/scheduled maintenance/i)).not.toBeDisabled();
  });

  it('clicking "Activate Maintenance" opens the confirm dialog', () => {
    render(<DeveloperSettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: /activate maintenance/i }));
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
  });

  it('cancelling the dialog closes it without calling mutateAsync', () => {
    render(<DeveloperSettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: /activate maintenance/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('confirming calls mutateAsync with maintenanceEnabled: true', async () => {
    render(<DeveloperSettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: /activate maintenance/i }));
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ maintenanceEnabled: true }),
      ),
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Maintenance mode activated' }),
    );
  });

  it('shows destructive toast when activate fails', async () => {
    mockMutateAsync.mockRejectedValue(new Error('Server error'));
    render(<DeveloperSettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: /activate maintenance/i }));
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' }),
      ),
    );
  });
});

// ── Maintenance card (maintenance ON) ────────────────────────────────────────

describe('DeveloperSettingsPanel — maintenance ON', () => {
  beforeEach(() => {
    mockUseSettings.mockReturnValue({
      data: { ...defaultSettings, maintenanceEnabled: true, maintenanceMessage: 'Deploy in progress' },
      isLoading: false,
    });
  });

  it('shows "Deactivate Maintenance" button', () => {
    render(<DeveloperSettingsPanel />);
    expect(screen.getByRole('button', { name: /deactivate maintenance/i })).toBeInTheDocument();
  });

  it('shows the "Active" badge', () => {
    render(<DeveloperSettingsPanel />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('textarea is disabled', () => {
    render(<DeveloperSettingsPanel />);
    expect(screen.getByPlaceholderText(/scheduled maintenance/i)).toBeDisabled();
  });

  it('clicking "Deactivate Maintenance" calls mutateAsync with maintenanceEnabled: false', async () => {
    render(<DeveloperSettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: /deactivate maintenance/i }));

    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith({ maintenanceEnabled: false, maintenanceMessage: '' }),
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Maintenance mode deactivated' }),
    );
  });

  it('shows destructive toast when deactivate fails', async () => {
    mockMutateAsync.mockRejectedValue(new Error('Network error'));
    render(<DeveloperSettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: /deactivate maintenance/i }));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive' }),
      ),
    );
  });
});

// ── Rate limit card ───────────────────────────────────────────────────────────

describe('DeveloperSettingsPanel — rate limit card', () => {
  it('shows rate limit input when rateLimitEnabled=true', () => {
    render(<DeveloperSettingsPanel />);
    expect(screen.getByRole('spinbutton')).toBeInTheDocument(); // number input
    expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument();
  });

  it('hides rate limit input when rateLimitEnabled=false', () => {
    mockUseSettings.mockReturnValue({
      data: { ...defaultSettings, rateLimitEnabled: false },
      isLoading: false,
    });
    render(<DeveloperSettingsPanel />);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('toggle calls mutateAsync with flipped rateLimitEnabled', async () => {
    render(<DeveloperSettingsPanel />);
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith({ rateLimitEnabled: false }),
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Rate limiting disabled' }),
    );
  });

  it('Save Configuration calls mutateAsync with rateLimitPerUser', async () => {
    render(<DeveloperSettingsPanel />);
    fireEvent.click(screen.getByRole('button', { name: /save configuration/i }));

    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith({ rateLimitPerUser: 50 }),
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringMatching(/rate limit set to 50/i) }),
    );
  });

  it('shows destructive toast when toggle fails', async () => {
    mockMutateAsync.mockRejectedValue(new Error('fail'));
    render(<DeveloperSettingsPanel />);
    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })),
    );
  });
});

// ── System info card ──────────────────────────────────────────────────────────

describe('DeveloperSettingsPanel — system info card', () => {
  it('shows skeleton grid when sysLoading=true', () => {
    mockUseSystemInfo.mockReturnValue({ data: undefined, isLoading: true });
    render(<DeveloperSettingsPanel />);
    // No metric values rendered
    expect(screen.queryByText('Server Uptime')).not.toBeInTheDocument();
  });

  it('shows fallback text when systemInfo is null', () => {
    mockUseSystemInfo.mockReturnValue({ data: null, isLoading: false });
    render(<DeveloperSettingsPanel />);
    expect(screen.getByText(/unable to load system information/i)).toBeInTheDocument();
  });

  it('renders all 8 metric InfoItems when systemInfo is available', () => {
    render(<DeveloperSettingsPanel />);
    expect(screen.getByText('Server Uptime')).toBeInTheDocument();
    expect(screen.getByText('Node.js Version')).toBeInTheDocument();
    expect(screen.getByText('Database Size')).toBeInTheDocument();
    expect(screen.getByText('Avg Response Time')).toBeInTheDocument();
    expect(screen.getByText('P95 Response Time')).toBeInTheDocument();
    expect(screen.getByText('Requests/min')).toBeInTheDocument();
    expect(screen.getByText('Total Requests')).toBeInTheDocument();
    expect(screen.getByText('Environment')).toBeInTheDocument();
  });

  it('formats uptime: 90061s → "1d 1h 1m"', () => {
    render(<DeveloperSettingsPanel />);
    expect(screen.getByText('1d 1h 1m')).toBeInTheDocument();
  });

  it('formats database size: 2097152 bytes → "2.0 MB"', () => {
    render(<DeveloperSettingsPanel />);
    expect(screen.getByText('2.0 MB')).toBeInTheDocument();
  });

  it('applies amber text class for non-production environment', () => {
    render(<DeveloperSettingsPanel />);
    const envValue = screen.getByText('development');
    expect(envValue.className).toContain('text-amber-600');
  });

  it('applies green text class for production environment', () => {
    mockUseSystemInfo.mockReturnValue({
      data: { ...defaultSystemInfo, environment: 'production' },
      isLoading: false,
    });
    render(<DeveloperSettingsPanel />);
    const envValue = screen.getByText('production');
    expect(envValue.className).toContain('text-green-700');
  });
});

// ── formatBytes edge cases (via rendering) ────────────────────────────────────

describe('DeveloperSettingsPanel — formatBytes edge cases', () => {
  it('shows "500 B" for 500 bytes', () => {
    mockUseSystemInfo.mockReturnValue({
      data: { ...defaultSystemInfo, databaseSizeBytes: 500 },
      isLoading: false,
    });
    render(<DeveloperSettingsPanel />);
    expect(screen.getByText('500 B')).toBeInTheDocument();
  });

  it('shows KB for 2048 bytes', () => {
    mockUseSystemInfo.mockReturnValue({
      data: { ...defaultSystemInfo, databaseSizeBytes: 2048 },
      isLoading: false,
    });
    render(<DeveloperSettingsPanel />);
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
  });

  it('shows GB for large sizes', () => {
    mockUseSystemInfo.mockReturnValue({
      data: { ...defaultSystemInfo, databaseSizeBytes: 2 * 1024 * 1024 * 1024 },
      isLoading: false,
    });
    render(<DeveloperSettingsPanel />);
    expect(screen.getByText('2.00 GB')).toBeInTheDocument();
  });
});

// ── formatUptime edge cases ───────────────────────────────────────────────────

describe('DeveloperSettingsPanel — formatUptime edge cases', () => {
  it('shows only minutes when uptime is under 1 hour', () => {
    mockUseSystemInfo.mockReturnValue({
      data: { ...defaultSystemInfo, uptime: 125 }, // 2m 5s → "2m"
      isLoading: false,
    });
    render(<DeveloperSettingsPanel />);
    expect(screen.getByText('2m')).toBeInTheDocument();
  });

  it('shows hours and minutes (no days) for uptime under 1 day', () => {
    mockUseSystemInfo.mockReturnValue({
      data: { ...defaultSystemInfo, uptime: 3661 }, // 1h 1m
      isLoading: false,
    });
    render(<DeveloperSettingsPanel />);
    expect(screen.getByText('1h 1m')).toBeInTheDocument();
  });
});
