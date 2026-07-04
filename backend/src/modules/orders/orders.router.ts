import { Router } from 'express';
import {
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
  duplicateOrder,
  removeOrder,
  patchOrderStatus,
  previewOrderPdf,
  sendOrder,
  downloadOrderPdf,
  exportOrdersCsv,
  archiveOrders,
} from './orders.controller.js';
import { previewPdfLimiter } from '../../middleware/rate-limit.middleware.js';
import { requireAdmin } from '../../middleware/role.middleware.js';

export const ordersRouter = Router();

// Literal routes MUST come before /:id param routes to prevent string segments
// from being matched as an order ID param.
ordersRouter.post('/preview-pdf', previewPdfLimiter, previewOrderPdf);
ordersRouter.get('/export/csv', requireAdmin, exportOrdersCsv);   // Must be before /:id
ordersRouter.post('/archive', requireAdmin, archiveOrders);        // Must be before /:id

ordersRouter.get('/', getOrders);
ordersRouter.post('/', createOrder);
ordersRouter.get('/:id', getOrder);
ordersRouter.get('/:id/pdf', downloadOrderPdf);
ordersRouter.put('/:id', updateOrder);
ordersRouter.patch('/:id/status', patchOrderStatus);
ordersRouter.post('/:id/duplicate', duplicateOrder);
ordersRouter.post('/:id/send', sendOrder);
ordersRouter.delete('/:id', requireAdmin, removeOrder);
