import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';

// ─── Service mock (hoisted before app import) ─────────────────────────────────
vi.mock('../orders.service', () => ({
  ordersService: {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    duplicate: vi.fn(),
    remove: vi.fn(),
    generatePreviewPdf: vi.fn(),
    markAsSent: vi.fn(),
    generateSavedOrderPdf: vi.fn(),
    archiveOldOrders: vi.fn(),
  },
}));

import { app } from '../../../app.js';
import { ordersService } from '../orders.service.js';
import { authHeader, createDispatcherToken } from '../../../__tests__/helpers/auth.js';
import { buildOrder } from '../../../__tests__/helpers/factories.js';

const mockService = vi.mocked(ordersService);

/** Minimal order row shape expected by buildCsv() */
function buildOrderRow() {
  return {
    ...buildOrder(),
    client: { name: 'Test Client SRL' },
    transporter: null,
    vehicle: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /api/orders ──────────────────────────────────────────────────────────
describe('GET /api/orders', () => {
  it('returns paginated order list', async () => {
    mockService.findAll.mockResolvedValue({
      items: [buildOrderRow()],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    } as never);

    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(1);
  });
});

// ─── GET /api/orders/:id ──────────────────────────────────────────────────────
describe('GET /api/orders/:id', () => {
  it('returns order when found', async () => {
    const order = buildOrderRow();
    mockService.findOne.mockResolvedValue(order as never);

    const res = await request(app)
      .get('/api/orders/1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.orderNumber).toBe(order.orderNumber);
  });

  it('returns 404 when order not found', async () => {
    mockService.findOne.mockRejectedValue(new Error('Order not found'));

    const res = await request(app)
      .get('/api/orders/999')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Order not found');
  });

  it('returns 400 for non-numeric ID', async () => {
    const res = await request(app)
      .get('/api/orders/abc')
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid order ID');
  });
});

// ─── POST /api/orders ─────────────────────────────────────────────────────────
describe('POST /api/orders', () => {
  const validBody = {
    clientId: 1,
    documentDate: new Date().toISOString(),
  };

  it('creates order and returns 201', async () => {
    const order = buildOrder();
    mockService.create.mockResolvedValue(order as never);

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', authHeader())
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orderNumber).toBe(order.orderNumber);
  });

  it('returns 400 on Zod validation error (missing clientId)', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', authHeader())
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ─── PUT /api/orders/:id ──────────────────────────────────────────────────────
describe('PUT /api/orders/:id', () => {
  it('updates order and returns success', async () => {
    const order = buildOrder({ driverName: 'Ion Popescu' });
    mockService.update.mockResolvedValue(order as never);

    const res = await request(app)
      .put('/api/orders/1')
      .set('Authorization', authHeader())
      .send({ clientId: 1, driverName: 'Ion Popescu' });

    expect(res.status).toBe(200);
    expect(res.body.data.driverName).toBe('Ion Popescu');
  });

  it('returns 400 when service throws "Cannot edit an archived order"', async () => {
    mockService.update.mockRejectedValue(new Error('Cannot edit an archived order'));

    const res = await request(app)
      .put('/api/orders/1')
      .set('Authorization', authHeader())
      .send({ clientId: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/archived/i);
  });
});

// ─── POST /api/orders/:id/duplicate ──────────────────────────────────────────
describe('POST /api/orders/:id/duplicate', () => {
  it('duplicates order and returns 201', async () => {
    const dup = buildOrder({ orderNumber: 'BGR2' });
    mockService.duplicate.mockResolvedValue(dup as never);

    const res = await request(app)
      .post('/api/orders/1/duplicate')
      .set('Authorization', authHeader());

    expect(res.status).toBe(201);
    expect(res.body.data.orderNumber).toBe('BGR2');
  });
});

// ─── DELETE /api/orders/:id ───────────────────────────────────────────────────
describe('DELETE /api/orders/:id', () => {
  it('deletes DRAFT order and returns null', async () => {
    mockService.remove.mockResolvedValue(undefined as never);

    const res = await request(app)
      .delete('/api/orders/1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it('returns 400 when order is active (Confirmed/In Progress)', async () => {
    mockService.remove.mockRejectedValue(
      new Error('Order must be cancelled or completed before it can be deleted.'),
    );

    const res = await request(app)
      .delete('/api/orders/1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('must be cancelled');
  });

  it('returns 403 when user is DISPATCHER', async () => {
    const res = await request(app)
      .delete('/api/orders/1')
      .set('Authorization', `Bearer ${createDispatcherToken()}`);

    expect(res.status).toBe(403);
    expect(mockService.remove).not.toHaveBeenCalled();
  });
});

// ─── PATCH /api/orders/:id/status ────────────────────────────────────────────
describe('PATCH /api/orders/:id/status', () => {
  it('patches status and returns updated order', async () => {
    const order = buildOrder({ status: 'CONFIRMED' as never });
    mockService.update.mockResolvedValue(order as never);

    const res = await request(app)
      .patch('/api/orders/1/status')
      .set('Authorization', authHeader())
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CONFIRMED');
  });

  it('returns 400 on invalid status value', async () => {
    const res = await request(app)
      .patch('/api/orders/1/status')
      .set('Authorization', authHeader())
      .send({ status: 'INVALID_STATUS' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when service throws "Cannot edit an archived order"', async () => {
    mockService.update.mockRejectedValue(new Error('Cannot edit an archived order'));

    const res = await request(app)
      .patch('/api/orders/1/status')
      .set('Authorization', authHeader())
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(400);
  });
});

// ─── POST /api/orders/preview-pdf ────────────────────────────────────────────
describe('POST /api/orders/preview-pdf', () => {
  it('returns PDF buffer with correct content-type', async () => {
    const pdfBuf = Buffer.from('%PDF-MOCK');
    mockService.generatePreviewPdf.mockResolvedValue(pdfBuf as never);

    const res = await request(app)
      .post('/api/orders/preview-pdf')
      .set('Authorization', authHeader())
      .send({ clientId: 1 });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });
});

// ─── POST /api/orders/:id/send ────────────────────────────────────────────────
describe('POST /api/orders/:id/send', () => {
  it('sends order and returns sentAt timestamp', async () => {
    const sentAt = new Date('2026-01-01T12:00:00Z');
    mockService.markAsSent.mockResolvedValue({ sentAt } as never);

    const res = await request(app)
      .post('/api/orders/1/send')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.sentAt).toBeDefined();
  });

  it('resends order successfully when already sent', async () => {
    const sentAt = new Date('2026-01-02T12:00:00Z');
    mockService.markAsSent.mockResolvedValue({ sentAt } as never);

    const res = await request(app)
      .post('/api/orders/1/send')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.sentAt).toBeDefined();
  });
});

// ─── GET /api/orders/:id/pdf ────────────────────────────────────────────────
describe('GET /api/orders/:id/pdf', () => {
  it('returns PDF with Content-Disposition header', async () => {
    const pdfBuf = Buffer.from('%PDF-MOCK');
    mockService.generateSavedOrderPdf.mockResolvedValue({
      pdfBuffer: pdfBuf,
      orderNumber: 'BGR1',
    } as never);

    const res = await request(app)
      .get('/api/orders/1/pdf')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('BGR1.pdf');
  });

  it('returns 404 when order not found', async () => {
    mockService.generateSavedOrderPdf.mockRejectedValue(new Error('Order not found'));

    const res = await request(app)
      .get('/api/orders/999/pdf')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Order not found');
  });

  it('returns 400 for non-numeric ID', async () => {
    const res = await request(app)
      .get('/api/orders/abc/pdf')
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid order ID');
  });

  it('returns 500 on unexpected error', async () => {
    mockService.generateSavedOrderPdf.mockRejectedValue(new Error('Puppeteer crashed'));

    const res = await request(app)
      .get('/api/orders/1/pdf')
      .set('Authorization', authHeader());

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });
});

// ─── POST /api/orders/archive ─────────────────────────────────────────────────
describe('POST /api/orders/archive', () => {
  it('returns archived count on success (admin)', async () => {
    mockService.archiveOldOrders.mockResolvedValue({ archived: 5 } as never);

    const res = await request(app)
      .post('/api/orders/archive')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data.archived).toBe(5);
  });

  it('returns 500 on unexpected error', async () => {
    mockService.archiveOldOrders.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .post('/api/orders/archive')
      .set('Authorization', authHeader());

    expect(res.status).toBe(500);
  });
});

// ─── GET /api/orders/export/csv ───────────────────────────────────────────────
describe('GET /api/orders/export/csv', () => {
  it('returns CSV file with correct headers', async () => {
    mockService.findAll.mockResolvedValue({
      items: [buildOrderRow()],
      total: 1,
      page: 1,
      limit: 9999,
      totalPages: 1,
    } as never);

    const res = await request(app)
      .get('/api/orders/export/csv')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text).toContain('Order Number');
  });
});

// ─── 500 error paths ──────────────────────────────────────────────────────────
describe('500 error handling', () => {
  it('GET /orders returns 500 on unexpected error', async () => {
    mockService.findAll.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/api/orders').set('Authorization', authHeader());
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });

  it('GET /orders/:id returns 500 on unexpected error', async () => {
    mockService.findOne.mockRejectedValue(new Error('DB error'));
    const res = await request(app).get('/api/orders/1').set('Authorization', authHeader());
    expect(res.status).toBe(500);
  });

  it('POST /orders returns 500 on unexpected error', async () => {
    mockService.create.mockRejectedValue(new Error('DB error'));
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', authHeader())
      .send({ clientId: 1, documentDate: new Date().toISOString() });
    expect(res.status).toBe(500);
  });

  it('PUT /orders/:id returns 404 when order not found', async () => {
    mockService.update.mockRejectedValue(new Error('Order not found'));
    const res = await request(app)
      .put('/api/orders/999')
      .set('Authorization', authHeader())
      .send({ clientId: 1 });
    expect(res.status).toBe(404);
  });

  it('PUT /orders/:id returns 500 on unexpected error', async () => {
    mockService.update.mockRejectedValue(new Error('DB error'));
    const res = await request(app)
      .put('/api/orders/1')
      .set('Authorization', authHeader())
      .send({ clientId: 1 });
    expect(res.status).toBe(500);
  });

  it('POST /orders/:id/duplicate returns 500 on unexpected error', async () => {
    mockService.duplicate.mockRejectedValue(new Error('DB error'));
    const res = await request(app)
      .post('/api/orders/1/duplicate')
      .set('Authorization', authHeader());
    expect(res.status).toBe(500);
  });

  it('DELETE /orders/:id returns 500 on unexpected error', async () => {
    mockService.remove.mockRejectedValue(new Error('DB error'));
    const res = await request(app).delete('/api/orders/1').set('Authorization', authHeader());
    expect(res.status).toBe(500);
  });

  it('PATCH /orders/:id/status returns 404 when order not found', async () => {
    mockService.update.mockRejectedValue(new Error('Order not found'));
    const res = await request(app)
      .patch('/api/orders/999/status')
      .set('Authorization', authHeader())
      .send({ status: 'CONFIRMED' });
    expect(res.status).toBe(404);
  });

  it('POST /orders/preview-pdf returns 500 on unexpected error', async () => {
    mockService.generatePreviewPdf.mockRejectedValue(new Error('Puppeteer error'));
    const res = await request(app)
      .post('/api/orders/preview-pdf')
      .set('Authorization', authHeader())
      .send({ clientId: 1 });
    expect(res.status).toBe(500);
  });

  it('POST /orders/:id/send returns 500 on unexpected error', async () => {
    mockService.markAsSent.mockRejectedValue(new Error('DB connection lost'));
    const res = await request(app)
      .post('/api/orders/1/send')
      .set('Authorization', authHeader());
    expect(res.status).toBe(500);
  });
});
