import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

// ─── Service mock (hoisted before app import) ─────────────────────────────────
vi.mock('../activity.service', () => ({
  activityService: {
    log: vi.fn(),
    findByOrder: vi.fn(),
  },
}));

import { app } from '../../../app.js';
import { activityService } from '../activity.service.js';
import { authHeader } from '../../../__tests__/helpers/auth.js';
import { buildActivityLog } from '../../../__tests__/helpers/factories.js';

const mockService = vi.mocked(activityService);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /api/orders/:orderId/activity ────────────────────────────────────────
describe('GET /api/orders/:orderId/activity', () => {
  it('returns activity log entries for a valid order ID', async () => {
    const log = buildActivityLog({ orderId: 5 });
    mockService.findByOrder.mockResolvedValue([log]);

    const res = await request(app)
      .get('/api/orders/5/activity')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].orderId).toBe(5);
    expect(mockService.findByOrder).toHaveBeenCalledWith(5);
  });

  it('returns 400 for non-numeric orderId', async () => {
    const res = await request(app)
      .get('/api/orders/xyz/activity')
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid order ID');
  });

  it('returns 401 without authentication token', async () => {
    const res = await request(app).get('/api/orders/1/activity');
    expect(res.status).toBe(401);
  });

  it('returns 500 on unexpected error', async () => {
    mockService.findByOrder.mockRejectedValue(new Error('DB error'));
    const res = await request(app)
      .get('/api/orders/1/activity')
      .set('Authorization', authHeader());
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });
});
