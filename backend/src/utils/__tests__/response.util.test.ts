import { describe, it, expect } from 'vitest';
import { success, error } from '../response.util.js';

describe('success', () => {
  it('returns a success envelope wrapping the data', () => {
    const result = success({ id: 1, name: 'Test' });
    expect(result).toEqual({ success: true, data: { id: 1, name: 'Test' } });
  });

  it('wraps null data', () => {
    const result = success(null);
    expect(result).toEqual({ success: true, data: null });
  });

  it('wraps an array', () => {
    const result = success([1, 2, 3]);
    expect(result).toEqual({ success: true, data: [1, 2, 3] });
  });
});

describe('error', () => {
  it('returns an error envelope with the message', () => {
    const result = error('Something went wrong');
    expect(result).toEqual({ success: false, error: 'Something went wrong' });
  });

  it('sets success to false', () => {
    const result = error('Any error');
    expect(result.success).toBe(false);
  });
});
