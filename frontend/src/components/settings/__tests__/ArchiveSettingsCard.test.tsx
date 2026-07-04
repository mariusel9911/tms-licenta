import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { ArchiveSettingsCard, type ArchiveFormFields } from '@/components/settings/ArchiveSettingsCard';

// ── Hoisted mock fns ─────────────────────────────────────────────────────────
const { mockUpdateMutateAsync, mockArchiveMutateAsync } = vi.hoisted(() => ({
  mockUpdateMutateAsync: vi.fn(),
  mockArchiveMutateAsync: vi.fn(),
}));

// ── Hook mocks ───────────────────────────────────────────────────────────────
vi.mock('@/hooks/useSettings', () => ({
  useSettings: vi.fn(() => ({
    data: {
      autoArchiveEnabled: true,
      autoArchiveAfterMonths: 3,
      autoArchiveFrequency: 'DAILY',
      autoArchiveDay: 1,
      autoArchiveTime: '02:00',
    },
  })),
  useUpdateSettings: vi.fn(() => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  })),
}));

vi.mock('@/hooks/useOrders', () => ({
  useArchiveOrders: vi.fn(() => ({
    mutateAsync: mockArchiveMutateAsync,
    isPending: false,
  })),
}));

// ── framer-motion stub (avoids animation errors in jsdom) ─────────────────────
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── Wrapper component ─────────────────────────────────────────────────────────

interface WrapperProps {
  months?: number;
  frequency?: string;
}

function Wrapper({ months = 3, frequency = 'DAILY' }: WrapperProps) {
  const form = useForm<ArchiveFormFields>({
    defaultValues: {
      autoArchiveAfterMonths: months,
      autoArchiveFrequency: frequency,
      autoArchiveDay: 1,
      autoArchiveTime: '02:00',
    },
  });
  return <ArchiveSettingsCard form={form} />;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateMutateAsync.mockResolvedValue({});
  mockArchiveMutateAsync.mockResolvedValue({ archived: 3 });
});

describe('ArchiveSettingsCard', () => {
  it('renders "Archive older than" label and months input', () => {
    render(<Wrapper />);
    expect(screen.getByText('Archive older than')).toBeInTheDocument();
    const input = screen.getByRole('spinbutton');
    expect(input).toHaveValue(3);
  });

  it('shows frequency selector (role="group") when auto-archive is enabled', () => {
    render(<Wrapper />);
    // settings.autoArchiveEnabled=true so the schedule section is shown
    expect(screen.getByRole('group', { name: 'Archive frequency' })).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
  });

  it('hides frequency selector when auto-archive is toggled off', async () => {
    render(<Wrapper />);
    // Initially the frequency group is visible (autoArchiveEnabled=true)
    expect(screen.getByRole('group', { name: 'Archive frequency' })).toBeInTheDocument();
    // Click the toggle switch to disable
    fireEvent.click(screen.getByRole('switch'));
    // Frequency selector should now be hidden
    await waitFor(() => {
      expect(screen.queryByRole('group', { name: 'Archive frequency' })).not.toBeInTheDocument();
    });
  });

  it('does not call mutation when months < 3', async () => {
    render(<Wrapper months={2} />);
    const saveBtn = screen.getByRole('button', { name: /save configuration/i });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
    });
  });

  it('does not call mutation when months > 120', async () => {
    render(<Wrapper months={121} />);
    const saveBtn = screen.getByRole('button', { name: /save configuration/i });
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
    });
  });

  it('calls updateMutation.mutateAsync with correct payload when schedule is dirty', async () => {
    // months=6 differs from settings.autoArchiveAfterMonths=3, so scheduleIsDirty=true
    render(<Wrapper months={6} />);
    const saveBtn = screen.getByRole('button', { name: /save configuration/i });
    expect(saveBtn).not.toBeDisabled();
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ autoArchiveAfterMonths: 6 }),
      );
    });
  });

  it('opens ConfirmDialog and calls archiveMutation.mutateAsync after confirmation', async () => {
    render(<Wrapper />);
    const archiveNowBtn = screen.getByRole('button', { name: /archive now/i });
    fireEvent.click(archiveNowBtn);

    // ConfirmDialog should appear
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Click the confirm button inside the dialog
    const confirmBtn = screen.getByRole('button', { name: 'Archive' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockArchiveMutateAsync).toHaveBeenCalled();
    });
  });

  it('cancels ConfirmDialog without archiving', async () => {
    render(<Wrapper />);
    fireEvent.click(screen.getByRole('button', { name: /archive now/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(mockArchiveMutateAsync).not.toHaveBeenCalled();
  });

  it('updates months input via onChange handler', () => {
    render(<Wrapper />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '12' } });
    expect(input).toHaveValue(12);
  });

  it('changes frequency to WEEKLY via button click', async () => {
    render(<Wrapper />);
    fireEvent.click(screen.getByRole('button', { name: 'Weekly' }));
    // After switching to WEEKLY the day-of-week select should appear
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  it('changes day-of-week select when WEEKLY frequency is active', async () => {
    render(<Wrapper frequency="WEEKLY" />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '3' } });
    // Wednesday (index 3) selected — value still present in select
    expect(select).toHaveValue('3');
  });

  it('changes day-of-month input when MONTHLY frequency is active', async () => {
    render(<Wrapper frequency="MONTHLY" />);
    // There are now two spinbuttons: months + day-of-month
    const inputs = screen.getAllByRole('spinbutton');
    const dayInput = inputs[1];
    fireEvent.change(dayInput, { target: { value: '15' } });
    expect(dayInput).toHaveValue(15);
  });

  it('changes time input via onChange handler', () => {
    render(<Wrapper />);
    const timeInput = screen.getByDisplayValue('02:00');
    fireEvent.change(timeInput, { target: { value: '06:00' } });
    expect(timeInput).toHaveValue('06:00');
  });
});
