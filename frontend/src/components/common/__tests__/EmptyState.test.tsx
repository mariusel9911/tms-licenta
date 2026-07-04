import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from '@/components/common/EmptyState';

describe('EmptyState', () => {
  it('renders icon, title and description', () => {
    render(<EmptyState title="No items found" description="Add your first item to get started." />);
    expect(screen.getByText('No items found')).toBeInTheDocument();
    expect(screen.getByText('Add your first item to get started.')).toBeInTheDocument();
    // Inbox icon renders as SVG
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders action button and calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="No items"
        action={{ label: 'Add item', onClick }}
      />,
    );
    const button = screen.getByRole('button', { name: 'Add item' });
    expect(button).toBeInTheDocument();
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders without description or action (minimal props)', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.getByText('Empty')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
