export type VehicleStatus = 'AVAILABLE' | 'ON_ROUTE' | 'MAINTENANCE' | 'INACTIVE';
export type FuelType = 'DIESEL' | 'PETROL' | 'ELECTRIC' | 'HYBRID' | 'LPG' | 'CNG';
export type ConsumptionRecording = 'MANUAL' | 'AUTOMATIC';

export interface Vehicle {
  id: number;
  licensePlate: string;
  vin: string | null;
  make: string | null;
  model: string | null;
  yearOfManufacture: number | null;
  emissionsStandard: string | null;
  axles: number | null;
  category: string | null;
  fuelType: FuelType | null;
  // Prisma Decimal fields come as strings over JSON
  lengthCm: string | null;
  widthCm: string | null;
  heightCm: string | null;
  maxLoadingCapacityKg: string | null;
  tankCapacityLitres: string | null;
  consumptionPer100km: string | null;
  consumptionRecording: ConsumptionRecording | null;
  ratePerKm: string | null;
  partnerId: number | null;
  partner: { id: number; name: string } | null;
  status: VehicleStatus;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedVehicles {
  items: Vehicle[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateVehicleDto {
  licensePlate: string;
  vin?: string;
  make?: string;
  model?: string;
  yearOfManufacture?: number;
  emissionsStandard?: string;
  axles?: number;
  category?: string;
  fuelType?: FuelType;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  maxLoadingCapacityKg?: number;
  tankCapacityLitres?: number;
  consumptionPer100km?: number;
  consumptionRecording?: ConsumptionRecording;
  ratePerKm?: number;
  partnerId?: number;
  status?: VehicleStatus;
  notes?: string;
}

export type UpdateVehicleDto = Partial<CreateVehicleDto>;
