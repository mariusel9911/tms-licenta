import { render } from '@testing-library/react';
import { TableSkeleton } from '@/components/common/TableSkeleton';

describe('TableSkeleton', () => {
  it('renders the specified number of rows', () => {
    const { container } = render(<TableSkeleton rows={5} columns={['w-32']} />);
    // The root div is the wrapper; each child div is a row
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.childElementCount).toBe(5);
  });

  it('renders the correct number of skeleton cells per row based on columns prop', () => {
    const { container } = render(<TableSkeleton rows={1} columns={['w-32', 'w-48', 'w-16']} />);
    const wrapper = container.firstChild as HTMLElement;
    const firstRow = wrapper.firstElementChild as HTMLElement;
    expect(firstRow.childElementCount).toBe(3);
  });

  it('uses default columns (3 cells) when columns prop is omitted', () => {
    const { container } = render(<TableSkeleton rows={1} />);
    const wrapper = container.firstChild as HTMLElement;
    const firstRow = wrapper.firstElementChild as HTMLElement;
    // DEFAULT_COLUMNS has 3 entries: ['flex-1', 'w-32', 'w-24']
    expect(firstRow.childElementCount).toBe(3);
  });

  it('defaults to 8 rows when rows prop is omitted', () => {
    const { container } = render(<TableSkeleton columns={['w-16']} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.childElementCount).toBe(8);
  });
});
