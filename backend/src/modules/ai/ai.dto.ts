import { z } from 'zod';

export const ChatDto = z.object({
  message: z.string().min(1).max(2000),
});

export type ChatDtoType = z.infer<typeof ChatDto>;

export const PredictionsQueryDto = z.object({
  timeframe: z.enum(['day', 'week', 'month']),
});

export type PredictionsQueryDtoType = z.infer<typeof PredictionsQueryDto>;

export const RevenueQueryDto = z.object({
  period: z.enum(['day', 'week', 'month', 'year', 'all']),
});

export type RevenueQueryDtoType = z.infer<typeof RevenueQueryDto>;

export const VehicleFinanceQueryDto = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  vehicleIds: z.string().optional(), // comma-separated integers: "1,2,3"
});

export type VehicleFinanceQueryDtoType = z.infer<typeof VehicleFinanceQueryDto>;
