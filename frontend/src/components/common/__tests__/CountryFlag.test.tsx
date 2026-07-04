import { render, screen } from '@testing-library/react';
import { CountryFlag } from '@/components/common/CountryFlag';

describe('CountryFlag', () => {
  it('renders a span with the country code as title attribute', () => {
    render(<CountryFlag countryCode="RO" />);
    const flag = screen.getByTitle('RO');
    expect(flag).toBeInTheDocument();
    expect(flag.tagName).toBe('SPAN');
  });

  it('renders without throwing for an unknown country code', () => {
    expect(() => render(<CountryFlag countryCode="XX" />)).not.toThrow();
    const flag = screen.getByTitle('XX');
    expect(flag).toBeInTheDocument();
  });

  it('accepts a className prop', () => {
    render(<CountryFlag countryCode="RO" className="custom-class" />);
    const flag = screen.getByTitle('RO');
    expect(flag).toHaveClass('custom-class');
  });
});
