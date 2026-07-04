import { vi } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import type { PrismaClient } from '../../generated/client.js';

/**
 * Shared deep mock of PrismaClient.
 * Usage in test files:
 *
 *   vi.mock('../../config/database', () => ({ prisma: prismaMock }));
 *   beforeEach(() => mockReset(prismaMock));
 *
 * For $transaction (callback variant):
 *   prismaMock.$transaction.mockImplementation(async (fn) => fn(prismaMock));
 */
export const prismaMock = mockDeep<PrismaClient>();

export { mockReset, vi };
