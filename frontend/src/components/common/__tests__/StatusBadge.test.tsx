import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/components/common/StatusBadge';

describe('StatusBadge', () => {
  it('renders "Draft" label and gray background for DRAFT', () => {
    render(<StatusBadge status="DRAFT" />);
    const badge = screen.getByText('Draft');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-gray-500');
  });

  it('renders "Confirmed" label and blue background for CONFIRMED', () => {
    render(<StatusBadge status="CONFIRMED" />);
    const badge = screen.getByText('Confirmed');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-blue-600');
  });

  it('renders "In Progress" label and amber background for IN_PROGRESS', () => {
    render(<StatusBadge status="IN_PROGRESS" />);
    const badge = screen.getByText('In Progress');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-amber-500');
  });

  it('renders "Delivered" label and green background for COMPLETED', () => {
    render(<StatusBadge status="COMPLETED" />);
    const badge = screen.getByText('Delivered');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-green-600');
  });

  it('renders "Cancelled" label and red background for CANCELLED', () => {
    render(<StatusBadge status="CANCELLED" />);
    const badge = screen.getByText('Cancelled');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-red-600');
  });

  it('accepts additional className prop', () => {
    render(<StatusBadge status="DRAFT" className="extra-class" />);
    const badge = screen.getByText('Draft');
    expect(badge).toHaveClass('extra-class');
  });
});
