import { describe, it, expect } from 'vitest';
import { ChatDto, PredictionsQueryDto, RevenueQueryDto } from '../ai.dto.js';

// ── ChatDto ──────────────────────────────────────────────────────────────────

describe('ChatDto', () => {
  it('accepts a valid message', () => {
    const result = ChatDto.safeParse({ message: 'How do I create an order?' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty string message', () => {
    const result = ChatDto.safeParse({ message: '' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('message');
  });

  it('rejects a message longer than 2000 characters', () => {
    const result = ChatDto.safeParse({ message: 'a'.repeat(2001) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain('message');
  });

  it('accepts a message of exactly 2000 characters', () => {
    const result = ChatDto.safeParse({ message: 'a'.repeat(2000) });
    expect(result.success).toBe(true);
  });

  it('rejects a missing message field', () => {
    const result = ChatDto.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects a non-string message', () => {
    const result = ChatDto.safeParse({ message: 42 });
    expect(result.success).toBe(false);
  });
});

// ── PredictionsQueryDto ───────────────────────────────────────────────────────

describe('PredictionsQueryDto', () => {
  it('accepts "day"', () => {
    const result = PredictionsQueryDto.safeParse({ timeframe: 'day' });
    expect(result.success).toBe(true);
  });

  it('accepts "week"', () => {
    const result = PredictionsQueryDto.safeParse({ timeframe: 'week' });
    expect(result.success).toBe(true);
  });

  it('accepts "month"', () => {
    const result = PredictionsQueryDto.safeParse({ timeframe: 'month' });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown timeframe', () => {
    const result = PredictionsQueryDto.safeParse({ timeframe: 'year' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing timeframe', () => {
    const result = PredictionsQueryDto.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ── RevenueQueryDto ───────────────────────────────────────────────────────────

describe('RevenueQueryDto', () => {
  const validPeriods = ['day', 'week', 'month', 'year', 'all'] as const;

  for (const period of validPeriods) {
    it(`accepts "${period}"`, () => {
      const result = RevenueQueryDto.safeParse({ period });
      expect(result.success).toBe(true);
    });
  }

  it('rejects an unknown period', () => {
    const result = RevenueQueryDto.safeParse({ period: 'quarter' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing period field', () => {
    const result = RevenueQueryDto.safeParse({});
    expect(result.success).toBe(false);
  });
});
