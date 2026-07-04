import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('merges multiple class names into a single string', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('resolves Tailwind utility conflicts — last class wins', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });
});
