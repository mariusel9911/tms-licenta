import { describe, it, expect } from 'vitest';
import { paginate, buildPaginationMeta } from '../pagination.util.js';

describe('paginate', () => {
  it('returns correct skip=0 and take=20 for page 1 with default limit', () => {
    const result = paginate(1, 20);
    expect(result.skip).toBe(0);
    expect(result.take).toBe(20);
  });

  it('returns correct skip for page 2', () => {
    const result = paginate(2, 20);
    expect(result.skip).toBe(20);
    expect(result.take).toBe(20);
  });

  it('uses defaults (page=1, limit=20) when no arguments provided', () => {
    const result = paginate();
    expect(result.skip).toBe(0);
    expect(result.take).toBe(20);
  });

  it('clamps limit to maximum of 500', () => {
    const result = paginate(1, 600);
    expect(result.take).toBe(500);
  });

  it('clamps page to minimum of 1 when 0 is passed', () => {
    const result = paginate(0, 20);
    expect(result.skip).toBe(0);
  });

  it('clamps page to minimum of 1 when negative is passed', () => {
    const result = paginate(-5, 20);
    expect(result.skip).toBe(0);
  });

  it('clamps limit to minimum of 1', () => {
    const result = paginate(1, 0);
    expect(result.take).toBe(1);
  });

  it('computes correct skip for page 3, limit 10', () => {
    const result = paginate(3, 10);
    expect(result.skip).toBe(20);
    expect(result.take).toBe(10);
  });
});

describe('buildPaginationMeta', () => {
  it('calculates totalPages correctly for evenly divisible total', () => {
    const meta = buildPaginationMeta(100, 1, 20);
    expect(meta.totalPages).toBe(5);
    expect(meta.total).toBe(100);
    expect(meta.page).toBe(1);
    expect(meta.limit).toBe(20);
  });

  it('rounds up totalPages for non-divisible total', () => {
    const meta = buildPaginationMeta(101, 1, 20);
    expect(meta.totalPages).toBe(6);
  });

  it('returns totalPages=1 for empty result set', () => {
    const meta = buildPaginationMeta(0, 1, 20);
    expect(meta.totalPages).toBe(0);
  });

  it('returns totalPages=1 when total equals limit', () => {
    const meta = buildPaginationMeta(10, 1, 10);
    expect(meta.totalPages).toBe(1);
  });
});
