import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { CreateOrderDto, UpdateOrderDto, FindAllOrdersDto, PatchOrderStatusDto } from './orders.dto.js';
import { ordersService } from './orders.service.js';

// --- CSV helper ---
function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return '';
  let str = String(val);
  if (/^[=+\-@]/.test(str)) str = '\t' + str;
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\t')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

type OrderRow = Awaited<ReturnType<typeof ordersService.findAll>>['items'][number];

function buildCsv(orders: OrderRow[]): string {
  const headers = [
    'Document Date',
    'Order Number',
    'Client',
    'Transporter',
    'Driver',
    'Vehicle',
    'Pickup Address',
    'Pickup Country',
    'Pickup Date',
    'Delivery Address',
    'Delivery Country',
    'Delivery Date',
    'Distance (km)',
    'Client Price (EUR)',
    'Transporter Price (EUR)',
    'Status',
    'Sent',
  ];

  const rows = orders.map((o) => [
    o.documentDate ? new Date(o.documentDate).toISOString().split('T')[0] : '',
    o.orderNumber,
    o.client?.name ?? '',
    o.transporter?.name ?? '',
    o.driverName ?? '',
    o.vehicle?.licensePlate ?? '',
    o.pickupAddress ?? '',
    o.pickupCountry ?? '',
    o.pickupDateBegin ? new Date(o.pickupDateBegin).toISOString() : '',
    o.deliveryAddress ?? '',
    o.deliveryCountry ?? '',
    o.deliveryDateBegin ? new Date(o.deliveryDateBegin).toISOString() : '',
    o.distanceKm != null ? Number(o.distanceKm) : '',
    o.clientPrice != null ? Number(o.clientPrice) : '',
    o.transporterPrice != null ? Number(o.transporterPrice) : '',
    o.status,
    o.isSent ? 'Yes' : 'No',
  ]);

  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((r) => r.map(csvEscape).join(',')),
  ];

  return lines.join('\r\n');
}

export const getOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = FindAllOrdersDto.parse(req.query);
    const result = await ordersService.findAll(query);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    req.log.error({ err: error }, 'getOrders failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid order ID' });
      return;
    }
    const order = await ordersService.findOne(id);
    res.json({ success: true, data: order });
  } catch (error) {
    if (error instanceof Error && error.message === 'Order not found') {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }
    req.log.error({ err: error }, 'getOrder failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const dto = CreateOrderDto.parse(req.body);
    const order = await ordersService.create(dto, req.user!.id);
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    req.log.error({ err: error }, 'createOrder failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const updateOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid order ID' });
      return;
    }
    const dto = UpdateOrderDto.parse(req.body);
    const order = await ordersService.update(id, dto, req.user!.id);
    res.json({ success: true, data: order });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    if (error instanceof Error && error.message === 'Order not found') {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }
    if (error instanceof Error && (
      error.message.startsWith('Cannot transition')
      || error.message.startsWith('Cannot start route')
      || error.message.startsWith('Cannot swap')
      || error.message.startsWith('Cannot edit an archived')
    )) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    req.log.error({ err: error }, 'updateOrder failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const duplicateOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid order ID' });
      return;
    }
    const order = await ordersService.duplicate(id, req.user!.id);
    res.status(201).json({ success: true, data: order });
  } catch (error) {
    if (error instanceof Error && error.message === 'Order not found') {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }
    req.log.error({ err: error }, 'duplicateOrder failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const removeOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid order ID' });
      return;
    }
    await ordersService.remove(id);
    res.json({ success: true, data: null });
  } catch (error) {
    if (error instanceof Error && error.message === 'Order not found') {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }
    if (error instanceof Error && error.message.startsWith('Order must be cancelled')) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    req.log.error({ err: error }, 'removeOrder failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const patchOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid order ID' });
      return;
    }
    const dto = PatchOrderStatusDto.parse(req.body);
    const order = await ordersService.update(id, dto, req.user!.id);
    res.json({ success: true, data: order });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    if (error instanceof Error && error.message === 'Order not found') {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }
    if (error instanceof Error && (
      error.message.startsWith('Cannot transition')
      || error.message.startsWith('Cannot start route')
      || error.message.startsWith('Cannot swap')
      || error.message.startsWith('Cannot edit an archived')
    )) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    req.log.error({ err: error }, 'patchOrderStatus failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const previewOrderPdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const dto = CreateOrderDto.parse(req.body);
    const pdfBuffer = await ordersService.generatePreviewPdf(dto);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="chartering-agreement-preview.pdf"');
    res.end(pdfBuffer);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    req.log.error({ err: error }, 'previewOrderPdf failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const sendOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid order ID' });
      return;
    }
    const result = await ordersService.markAsSent(id, req.user!.id);
    res.json({ success: true, data: { sentAt: result.sentAt } });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === 'Order not found' ||
        error.message.includes('no email') ||
        error.message.includes('SMTP')
      ) {
        const status = error.message === 'Order not found' ? 404 : 400;
        res.status(status).json({ success: false, error: error.message });
        return;
      }
    }
    req.log.error({ err: error }, 'sendOrder failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const downloadOrderPdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid order ID' });
      return;
    }
    const { pdfBuffer, orderNumber } = await ordersService.generateSavedOrderPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${orderNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    if (error instanceof Error && error.message === 'Order not found') {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }
    req.log.error({ err: error }, 'downloadOrderPdf failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const archiveOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await ordersService.archiveOldOrders();
    res.json({ success: true, data: result });
  } catch (error) {
    req.log.error({ err: error }, 'archiveOrders failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const exportOrdersCsv = async (req: Request, res: Response): Promise<void> => {
  try {
    const dto = FindAllOrdersDto.parse({ ...req.query, limit: 9999, page: 1 });
    const { items } = await ordersService.findAll(dto);
    const csv = buildCsv(items);
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=orders-export-${date}.csv`);
    res.send(csv);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ success: false, error: error.issues });
      return;
    }
    req.log.error({ err: error }, 'exportOrdersCsv failed');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
