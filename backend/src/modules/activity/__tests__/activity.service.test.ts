import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mockReset } from 'vitest-mock-extended';

import { prismaMock } from '../../../__tests__/helpers/prisma-mock.js';

vi.mock('../../../config/database', () => ({
  prisma: prismaMock,
}));

import { activityService } from '../activity.service.js';
import { buildActivityLog } from '../../../__tests__/helpers/factories.js';

beforeEach(() => {
  mockReset(prismaMock);
});

describe('activityService.log()', () => {
  it('creates an activity log entry with the given fields', async () => {
    const expected = buildActivityLog({ orderId: 5, userId: 2, action: 'status changed', details: 'DRAFT → CONFIRMED' });
    prismaMock.activityLog.create.mockResolvedValue(expected);

    const result = await activityService.log(5, 2, 'status changed', 'DRAFT → CONFIRMED');

    expect(prismaMock.activityLog.create).toHaveBeenCalledWith({
      data: { orderId: 5, userId: 2, action: 'status changed', details: 'DRAFT → CONFIRMED' },
    });
    expect(result).toEqual(expected);
  });
});

describe('activityService.findByOrder()', () => {
  it('returns activity logs sorted descending with user relation', async () => {
    const logs = [
      { ...buildActivityLog({ id: 2, orderId: 1, action: 'updated' }), user: { id: 1, name: 'Admin' } },
      { ...buildActivityLog({ id: 1, orderId: 1, action: 'created' }), user: { id: 1, name: 'Admin' } },
    ];
    prismaMock.activityLog.findMany.mockResolvedValue(logs as never);

    const result = await activityService.findByOrder(1);

    expect(prismaMock.activityLog.findMany).toHaveBeenCalledWith({
      where: { orderId: 1 },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true } } },
    });
    expect(result).toHaveLength(2);
    expect(result[0].action).toBe('updated');
  });
});
