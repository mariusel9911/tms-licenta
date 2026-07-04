import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AiSettingsCard } from '@/components/settings/AiSettingsCard';

// ── Hoisted mock fns ─────────────────────────────────────────────────────────
const { mockUseSettings, mockMutateAsync } = vi.hoisted(() => ({
  mockUseSettings: vi.fn(),
  mockMutateAsync: vi.fn(),
}));

// ── Hook mocks ───────────────────────────────────────────────────────────────
vi.mock('@/hooks/useSettings', () => ({
  useSettings: mockUseSettings,
  useUpdateSettings: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

// ── framer-motion stub (avoids animation errors in jsdom) ─────────────────────
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockMutateAsync.mockResolvedValue({});
  mockUseSettings.mockReturnValue({
    data: { aiChatbotEnabled: true, aiPredictionEnabled: true },
    isLoading: false,
  });
});

describe('AiSettingsCard', () => {
  it('renders "AI Features" card title', () => {
    render(<AiSettingsCard />);
    expect(screen.getByText('AI Features')).toBeInTheDocument();
  });

  it('renders AI Chatbot toggle row with label and description', () => {
    render(<AiSettingsCard />);
    expect(screen.getByText('AI Chatbot')).toBeInTheDocument();
    expect(screen.getByText(/sparky assistant is available/i)).toBeInTheDocument();
  });

  it('renders AI Prediction Model toggle row with label and description', () => {
    render(<AiSettingsCard />);
    expect(screen.getByText('AI Prediction Model')).toBeInTheDocument();
    expect(screen.getByText(/profit predictions visible/i)).toBeInTheDocument();
  });

  it('chatbot toggle is checked (bg-green-600) when aiChatbotEnabled is true', () => {
    render(<AiSettingsCard />);
    const toggles = screen.getAllByRole('switch');
    expect(toggles[0]).toHaveAttribute('aria-checked', 'true');
    expect(toggles[0]).toHaveClass('bg-green-600');
  });

  it('prediction toggle is checked when aiPredictionEnabled is true', () => {
    render(<AiSettingsCard />);
    const toggles = screen.getAllByRole('switch');
    expect(toggles[1]).toHaveAttribute('aria-checked', 'true');
    expect(toggles[1]).toHaveClass('bg-green-600');
  });

  it('chatbot toggle is unchecked (bg-gray-200) when aiChatbotEnabled is false', () => {
    mockUseSettings.mockReturnValue({
      data: { aiChatbotEnabled: false, aiPredictionEnabled: true },
      isLoading: false,
    });
    render(<AiSettingsCard />);
    const toggles = screen.getAllByRole('switch');
    expect(toggles[0]).toHaveAttribute('aria-checked', 'false');
    expect(toggles[0]).toHaveClass('bg-gray-200');
  });

  it('clicking chatbot toggle calls mutateAsync with { aiChatbotEnabled: false } when currently true', async () => {
    render(<AiSettingsCard />);
    const toggles = screen.getAllByRole('switch');
    fireEvent.click(toggles[0]);
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ aiChatbotEnabled: false });
    });
  });

  it('clicking prediction toggle calls mutateAsync with { aiPredictionEnabled: false } when currently true', async () => {
    render(<AiSettingsCard />);
    const toggles = screen.getAllByRole('switch');
    fireEvent.click(toggles[1]);
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({ aiPredictionEnabled: false });
    });
  });

  it('shows skeleton rows while isLoading is true', () => {
    mockUseSettings.mockReturnValue({ data: undefined, isLoading: true });
    render(<AiSettingsCard />);
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByText('AI Chatbot')).not.toBeInTheDocument();
  });
});
