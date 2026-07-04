import { describe, it, expect, beforeEach } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import type { PrismaClient } from '../../../generated/client.js';
import { generateOrderNumber } from '../order-number.util.js';

const prismaMock = mockDeep<PrismaClient>();

beforeEach(() => {
  mockReset(prismaMock);
});

describe('generateOrderNumber', () => {
  it('uses startNumber when no existing orders (max is null)', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ max_num: null }]);

    const result = await generateOrderNumber(prismaMock as unknown as PrismaClient, 'BGR', 100);
    expect(result).toBe('BGR100');
  });

  it('increments from existing max', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ max_num: BigInt(50) }]);

    const result = await generateOrderNumber(prismaMock as unknown as PrismaClient, 'BGR', 1);
    expect(result).toBe('BGR51');
  });

  it('uses default startNumber of 1 when third argument is omitted', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ max_num: null }]);

    const result = await generateOrderNumber(prismaMock as unknown as PrismaClient, 'BGR');
    expect(result).toBe('BGR1');
  });

  it('uses startNumber when existing max is below startNumber (floor behavior)', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ max_num: BigInt(5) }]);

    const result = await generateOrderNumber(prismaMock as unknown as PrismaClient, 'BGR', 100);
    expect(result).toBe('BGR100');
  });

  it('includes the series prefix in the generated number', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ max_num: BigInt(314) }]);

    const result = await generateOrderNumber(prismaMock as unknown as PrismaClient, 'BGR', 1);
    expect(result).toBe('BGR315');
    expect(result.startsWith('BGR')).toBe(true);
  });
});
