export type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface AddressStop {
  address?: string;
  country?: string;
  dateBegin?: string;
}

export interface CargoItem {
  qty?: number;
  description?: string;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  weightKg?: number;
}

export interface OrderPartnerRef {
  id: number;
  name: string;
  country?: string;
}

export interface OrderVehicleRef {
  id: number;
  licensePlate: string;
  status: import('./vehicle.types').VehicleStatus;
}

export interface Order {
  id: number;
  orderNumber: string;
  orderSeries: string;
  clientOrderReference: string | null;
  transporterReference: string | null;
  intermediaryPartnerRef: string | null;
  clientId: number;
  client: OrderPartnerRef | null;
  transporterId: number | null;
  transporter: OrderPartnerRef | null;
  vehicleId: number | null;
  vehicle: OrderVehicleRef | null;
  driverName: string | null;
  contactName: string | null;
  pickupAddress: string | null;
  pickupCountry: string | null;
  pickupDateBegin: string | null;
  pickupDateEnd: string | null;
  deliveryAddress: string | null;
  deliveryCountry: string | null;
  deliveryDateBegin: string | null;
  deliveryDateEnd: string | null;
  // Prisma Decimal fields come as strings over JSON
  distanceKm: string | null;
  transporterPrice: string | null;
  transporterCurrency: string | null;
  clientPrice: string | null;
  clientCurrency: string | null;
  cargoQuantity: number | null;
  cargoDescription: string | null;
  cargoLengthCm: string | null;
  cargoWidthCm: string | null;
  cargoHeightCm: string | null;
  cargoWeightKg: string | null;
  cargoItemsJson: string | null;
  additionalPickupsJson: string | null;
  additionalDeliveriesJson: string | null;
  internalNotes: string | null;
  status: OrderStatus;
  isSent: boolean;
  sentAt: string | null;
  applyStamp: boolean;
  finalizedAt: string | null;
  archivedAt: string | null;
  notes: string | null;
  documentDate: string;
  createdById: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedOrders {
  items: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface OrderFilters {
  search?: string;
  status?: OrderStatus | '';
  clientId?: number;
  transporterId?: number;
  vehicleId?: number;
  archived?: boolean;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateOrderDto {
  clientId: number;
  orderSeries?: string;
  clientOrderReference?: string;
  transporterReference?: string;
  intermediaryPartnerRef?: string;
  transporterId?: number;
  vehicleId?: number;
  driverName?: string;
  contactName?: string;
  pickupAddress?: string;
  pickupCountry?: string;
  pickupDateBegin?: string;
  pickupDateEnd?: string;
  deliveryAddress?: string;
  deliveryCountry?: string;
  deliveryDateBegin?: string;
  deliveryDateEnd?: string;
  distanceKm?: number;
  transporterPrice?: number;
  transporterCurrency?: string;
  clientPrice?: number;
  clientCurrency?: string;
  cargoQuantity?: number;
  cargoDescription?: string;
  cargoLengthCm?: number;
  cargoWidthCm?: number;
  cargoHeightCm?: number;
  cargoWeightKg?: number;
  cargoItems?: CargoItem[];
  additionalPickups?: AddressStop[];
  additionalDeliveries?: AddressStop[];
  internalNotes?: string;
  status?: OrderStatus;
  notes?: string;
  documentDate?: string;
  // PDF preview only — pass existing order number so it renders in the PDF
  orderNumber?: string;
  applyStamp?: boolean;
}

export type UpdateOrderDto = Partial<CreateOrderDto>;
