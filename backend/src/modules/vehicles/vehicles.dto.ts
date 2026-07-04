import { z } from 'zod';

export const CreateVehicleDto = z.object({
  // Required
  licensePlate: z.string().min(1, 'License plate is required'),
  // Optional identification
  vin: z.string().optional(),
  // Optional characteristics
  make: z.string().optional(),
  model: z.string().optional(),
  yearOfManufacture: z.number().int().min(1900).max(2100).optional(),
  emissionsStandard: z.string().optional(),
  axles: z.number().int().min(1).optional(),
  category: z.string().optional(),
  fuelType: z.enum(['DIESEL', 'PETROL', 'ELECTRIC', 'HYBRID', 'LPG', 'CNG'] as const).optional(),
  // Optional dimensions & capacity
  lengthCm: z.number().min(0).optional(),
  widthCm: z.number().min(0).optional(),
  heightCm: z.number().min(0).optional(),
  maxLoadingCapacityKg: z.number().min(0).optional(),
  // Optional consumption
  tankCapacityLitres: z.number().min(0).optional(),
  consumptionPer100km: z.number().min(0).optional(),
  consumptionRecording: z.enum(['MANUAL', 'AUTOMATIC'] as const).optional(),
  ratePerKm: z.number().min(0).optional(),
  // Optional FK
  partnerId: z.number().int().optional(),
  // Optional status & notes
  status: z.enum(['AVAILABLE', 'ON_ROUTE', 'MAINTENANCE', 'INACTIVE'] as const).optional(),
  notes: z.string().optional(),
});

export type CreateVehicleDtoType = z.infer<typeof CreateVehicleDto>;

export const UpdateVehicleDto = CreateVehicleDto.partial();

export type UpdateVehicleDtoType = z.infer<typeof UpdateVehicleDto>;

export const FindAllVehiclesDto = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(500).optional().default(20),
  search: z.string().max(200).optional(),
  status: z.enum(['AVAILABLE', 'ON_ROUTE', 'MAINTENANCE', 'INACTIVE'] as const).optional(),
});

export type FindAllVehiclesDtoType = z.infer<typeof FindAllVehiclesDto>;
