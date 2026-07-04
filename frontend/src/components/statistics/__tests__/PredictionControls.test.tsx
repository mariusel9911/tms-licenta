import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PredictionControls } from '../PredictionControls';

describe('PredictionControls', () => {
  const onTimeframeChange = vi.fn();
  const onRefresh = vi.fn();

  const defaultProps = {
    timeframe: 'day' as const,
    onTimeframeChange,
    onRefresh,
    isRefreshing: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ───────────────────────────────────────────────────────────────

  it('renders all three timeframe buttons', () => {
    render(<PredictionControls {...defaultProps} />);

    expect(screen.getByRole('button', { name: 'Daily' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Weekly' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Monthly' })).toBeInTheDocument();
  });

  it('renders the Refresh button', () => {
    render(<PredictionControls {...defaultProps} />);

    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });

  it('renders the forecast period group with aria-label', () => {
    render(<PredictionControls {...defaultProps} />);

    expect(screen.getByRole('group', { name: 'Forecast period' })).toBeInTheDocument();
  });

  // ── Timeframe button clicks ─────────────────────────────────────────────────

  it('calls onTimeframeChange with "day" when Daily is clicked', async () => {
    const user = userEvent.setup();
    render(<PredictionControls {...defaultProps} timeframe="week" />);

    await user.click(screen.getByRole('button', { name: 'Daily' }));

    expect(onTimeframeChange).toHaveBeenCalledTimes(1);
    expect(onTimeframeChange).toHaveBeenCalledWith('day');
  });

  it('calls onTimeframeChange with "week" when Weekly is clicked', async () => {
    const user = userEvent.setup();
    render(<PredictionControls {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Weekly' }));

    expect(onTimeframeChange).toHaveBeenCalledWith('week');
  });

  it('calls onTimeframeChange with "month" when Monthly is clicked', async () => {
    const user = userEvent.setup();
    render(<PredictionControls {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Monthly' }));

    expect(onTimeframeChange).toHaveBeenCalledWith('month');
  });

  // ── Refresh button ──────────────────────────────────────────────────────────

  it('calls onRefresh when Refresh button is clicked', async () => {
    const user = userEvent.setup();
    render(<PredictionControls {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /refresh/i }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('Refresh button is disabled when isRefreshing=true', () => {
    render(<PredictionControls {...defaultProps} isRefreshing />);

    expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled();
  });

  it('Refresh button is enabled when isRefreshing=false', () => {
    render(<PredictionControls {...defaultProps} isRefreshing={false} />);

    expect(screen.getByRole('button', { name: /refresh/i })).not.toBeDisabled();
  });

  it('does not call onRefresh when Refresh button is disabled (isRefreshing=true)', async () => {
    const user = userEvent.setup();
    render(<PredictionControls {...defaultProps} isRefreshing />);

    await user.click(screen.getByRole('button', { name: /refresh/i }));

    expect(onRefresh).not.toHaveBeenCalled();
  });

  // ── Spin icon class ─────────────────────────────────────────────────────────

  it('RefreshCw icon has animate-spin class when isRefreshing=true', () => {
    render(<PredictionControls {...defaultProps} isRefreshing />);

    // The SVG icon is the first child of the refresh button
    const refreshBtn = screen.getByRole('button', { name: /refresh/i });
    const icon = refreshBtn.querySelector('svg');
    expect(icon).toHaveClass('animate-spin');
  });

  it('RefreshCw icon does not have animate-spin class when isRefreshing=false', () => {
    render(<PredictionControls {...defaultProps} isRefreshing={false} />);

    const refreshBtn = screen.getByRole('button', { name: /refresh/i });
    const icon = refreshBtn.querySelector('svg');
    expect(icon).not.toHaveClass('animate-spin');
  });
});
