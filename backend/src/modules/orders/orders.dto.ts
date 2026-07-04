import { z } from 'zod';

export const CargoItemSchema = z.object({
  qty: z.number().int().min(0).optional(),
  description: z.string().optional(),
  lengthCm: z.number().min(0).optional(),
  widthCm: z.number().min(0).optional(),
  heightCm: z.number().min(0).optional(),
  weightKg: z.number().min(0).optional(),
});

export type CargoItemType = z.infer<typeof CargoItemSchema>;

export const AddressStopSchema = z.object({
  address: z.string().max(500).optional(),
  country: z.string().max(100).optional(),
  dateBegin: z.string().datetime({ offset: true }).optional(),
});

export type AddressStopType = z.infer<typeof AddressStopSchema>;

export const CreateOrderDto = z.object({
  // Required
  clientId: z.number().int().positive('Client is required'),

  // Optional references
  orderSeries: z.string().regex(/^[A-Z]{2,6}$/, 'Order series must be 2–6 uppercase letters').optional(),
  clientOrderReference: z.string().max(100).optional(),
  transporterReference: z.string().max(100).optional(),
  intermediaryPartnerRef: z.string().max(100).optional(),

  // Optional FKs
  transporterId: z.number().int().positive().optional(),
  vehicleId: z.number().int().positive().optional(),

  // Optional driver & contact
  driverName: z.string().max(200).optional(),
  contactName: z.string().max(200).optional(),

  // Optional pickup
  pickupAddress: z.string().max(500).optional(),
  pickupCountry: z.string().max(100).optional(),
  pickupDateBegin: z.string().datetime({ offset: true }).optional(),
  pickupDateEnd: z.string().datetime({ offset: true }).optional(),

  // Optional delivery
  deliveryAddress: z.string().max(500).optional(),
  deliveryCountry: z.string().max(100).optional(),
  deliveryDateBegin: z.string().datetime({ offset: true }).optional(),
  deliveryDateEnd: z.string().datetime({ offset: true }).optional(),

  // Optional financials
  distanceKm: z.number().min(0).optional(),
  transporterPrice: z.number().min(0).optional(),
  transporterCurrency: z.string().max(10).optional(),
  clientPrice: z.number().min(0).optional(),
  clientCurrency: z.string().max(10).optional(),

  // Legacy single-cargo fields (kept for backward compat)
  cargoQuantity: z.number().int().min(0).optional(),
  cargoDescription: z.string().max(500).optional(),
  cargoLengthCm: z.number().min(0).optional(),
  cargoWidthCm: z.number().min(0).optional(),
  cargoHeightCm: z.number().min(0).optional(),
  cargoWeightKg: z.number().min(0).optional(),

  // Multi-cargo items (new)
  cargoItems: z.array(CargoItemSchema).max(500).optional(),

  // Additional address stops
  additionalPickups: z.array(AddressStopSchema).max(20).optional(),
  additionalDeliveries: z.array(AddressStopSchema).max(20).optional(),

  // Optional status & notes
  status: z.enum(['DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const).optional(),
  notes: z.string().max(2000).optional(),
  internalNotes: z.string().max(1024).optional(),
  documentDate: z.string().datetime({ offset: true }).optional(),

  // PDF preview only — pass existing order number so it shows in the PDF instead of placeholder
  orderNumber: z.string().optional(),

  // Electronic stamp (M33)
  applyStamp: z.boolean().optional(),
});

export type CreateOrderDtoType = z.infer<typeof CreateOrderDto>;

export const UpdateOrderDto = CreateOrderDto.partial();

export type UpdateOrderDtoType = z.infer<typeof UpdateOrderDto>;

export const FindAllOrdersDto = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(9999).optional().default(20),
  search: z.string().max(200).optional(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const).optional(),
  clientId: z.coerce.number().int().positive().optional(),
  transporterId: z.coerce.number().int().positive().optional(),
  vehicleId: z.coerce.number().int().positive().optional(),
  archived: z.coerce.boolean().optional().default(false),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  sortBy: z.enum([
    'createdAt', 'documentDate', 'orderNumber', 'status', 'isSent',
    'client.name', 'clientOrderReference', 'transporter.name', 'driverName',
    'pickupDateBegin', 'deliveryDateBegin', 'distanceKm', 'clientPrice', 'transporterPrice',
  ]).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type FindAllOrdersDtoType = z.infer<typeof FindAllOrdersDto>;

export const PatchOrderStatusDto = z.object({
  status: z.enum(['DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const),
});

export type PatchOrderStatusDtoType = z.infer<typeof PatchOrderStatusDto>;
