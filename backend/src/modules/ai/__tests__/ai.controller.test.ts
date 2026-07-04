import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

// ── Service mocks (hoisted before app import) ─────────────────────────────────
vi.mock('../ai.service', () => ({
  chat: vi.fn(),
  getStatistics: vi.fn(),
  getRevenue: vi.fn(),
  getPredictions: vi.fn(),
  incrementOrdersVersion: vi.fn(),
  loadKnowledgeBase: vi.fn(),
}));

// knowledge-loader must be mocked to prevent fs access when ai.service is loaded
// (even though we mock ai.service, the controller test imports app which loads the real service
//  if knowledge-loader is not mocked — so we mock it defensively)
vi.mock('../knowledge-loader', () => ({
  loadKnowledgeBase: vi.fn(),
  retrieveContext: vi.fn().mockReturnValue([]),
}));

// ai-toggle middlewares must be mocked as pass-through. Otherwise they hit
// prisma.appSettings.findUnique, which is not mocked in this supertest-style
// test file, and fail-closed defaults would make every request return 503.
// Toggle-gate behavior is covered by ai-toggle.middleware.test.ts.
vi.mock('../../../middleware/ai-toggle.middleware', () => ({
  requireChatbotEnabled: (_req: unknown, _res: unknown, next: () => void) => next(),
  requirePredictionsEnabled: (_req: unknown, _res: unknown, next: () => void) => next(),
  clearAiToggleCache: vi.fn(),
  isChatbotEnabled: vi.fn().mockResolvedValue(true),
  isPredictionEnabled: vi.fn().mockResolvedValue(true),
}));

import { app } from '../../../app.js';
import * as aiService from '../ai.service.js';
import { authHeader } from '../../../__tests__/helpers/auth.js';

const mockAiService = vi.mocked(aiService);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── POST /api/ai/chat ─────────────────────────────────────────────────────────

describe('POST /api/ai/chat', () => {
  it('returns 401 when no auth token provided', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .send({ message: 'Hello' });

    expect(res.status).toBe(401);
  });

  it('returns 400 when message is missing', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', authHeader())
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when message is empty string', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', authHeader())
      .send({ message: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 with chat response on valid request', async () => {
    mockAiService.chat.mockResolvedValue({ response: 'Here is the answer.' });

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', authHeader())
      .send({ message: 'How do I create an order?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.response).toBe('Here is the answer.');
  });
});

// ── GET /api/ai/statistics ────────────────────────────────────────────────────

describe('GET /api/ai/statistics', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/ai/statistics');

    expect(res.status).toBe(401);
  });

  it('returns 200 with statistics data', async () => {
    const mockStats = {
      totalOrders: 42,
      ordersThisMonth: 10,
      ordersThisWeek: 3,
      revenueByStatus: {},
      monthlyRevenue: [],
      topClients: [],
      topTransporters: [],
      avgClientPrice: 0,
      avgTransporterPrice: 0,
    };
    mockAiService.getStatistics.mockResolvedValue(mockStats);

    const res = await request(app)
      .get('/api/ai/statistics')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalOrders).toBe(42);
  });
});

// ── GET /api/ai/predictions ───────────────────────────────────────────────────

describe('GET /api/ai/predictions', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/ai/predictions?timeframe=day');

    expect(res.status).toBe(401);
  });

  it('returns 400 when timeframe is invalid', async () => {
    const res = await request(app)
      .get('/api/ai/predictions?timeframe=invalid')
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when timeframe is missing', async () => {
    const res = await request(app)
      .get('/api/ai/predictions')
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
  });

  it('returns 200 with prediction data for valid timeframe', async () => {
    const mockPredictions = {
      timeframe: 'day',
      labels: ['Mar 18'],
      historical: [1000],
      predicted: [1100],
    };
    mockAiService.getPredictions.mockResolvedValue(mockPredictions);

    const res = await request(app)
      .get('/api/ai/predictions?timeframe=day')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.timeframe).toBe('day');
  });

  it('passes skipCache=true when ?refresh=true', async () => {
    mockAiService.getPredictions.mockResolvedValue({
      timeframe: 'week',
      labels: [],
      historical: [],
      predicted: [],
    });

    await request(app)
      .get('/api/ai/predictions?timeframe=week&refresh=true')
      .set('Authorization', authHeader());

    expect(mockAiService.getPredictions).toHaveBeenCalledWith('week', true);
  });

  it('passes skipCache=false when ?refresh is absent', async () => {
    mockAiService.getPredictions.mockResolvedValue({
      timeframe: 'month',
      labels: [],
      historical: [],
      predicted: [],
    });

    await request(app)
      .get('/api/ai/predictions?timeframe=month')
      .set('Authorization', authHeader());

    expect(mockAiService.getPredictions).toHaveBeenCalledWith('month', false);
  });
});

// ── GET /api/ai/revenue ───────────────────────────────────────────────────────

describe('GET /api/ai/revenue', () => {
  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/ai/revenue?period=day');

    expect(res.status).toBe(401);
  });

  it('returns 400 when period is invalid', async () => {
    const res = await request(app)
      .get('/api/ai/revenue?period=quarter')
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when period is missing', async () => {
    const res = await request(app)
      .get('/api/ai/revenue')
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
  });

  it('returns 200 with revenue data for valid period', async () => {
    const mockRevenue = [{ label: 'Mar 18', revenue: 1000, profit: 200 }];
    mockAiService.getRevenue.mockResolvedValue(mockRevenue);

    const res = await request(app)
      .get('/api/ai/revenue?period=day')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(mockRevenue);
  });

  it('handles all valid period values', async () => {
    mockAiService.getRevenue.mockResolvedValue([]);

    for (const period of ['day', 'week', 'month', 'year', 'all']) {
      mockAiService.getRevenue.mockClear();
      const res = await request(app)
        .get(`/api/ai/revenue?period=${period}`)
        .set('Authorization', authHeader());

      expect(res.status).toBe(200);
    }
  });
});
