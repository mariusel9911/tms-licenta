import { apiClient } from './client';
import type {
  StatisticsData,
  PredictionData,
  PredictionTimeframe,
  RevenueDataPoint,
  RevenueViewPeriod,
  VehicleFinanceDataPoint,
  VehicleFinanceFilters,
} from '@/types/statistics.types';

export async function getStatisticsApi(): Promise<StatisticsData> {
  const res = await apiClient.get<{ success: boolean; data: StatisticsData }>('/ai/statistics');
  return res.data.data;
}

export async function getPredictionsApi(timeframe: PredictionTimeframe, refresh = false): Promise<PredictionData> {
  const params = new URLSearchParams({ timeframe });
  if (refresh) params.set('refresh', 'true');
  const res = await apiClient.get<{ success: boolean; data: PredictionData }>(
    `/ai/predictions?${params.toString()}`,
  );
  return res.data.data;
}

export async function getRevenueApi(period: RevenueViewPeriod): Promise<RevenueDataPoint[]> {
  const res = await apiClient.get<{ success: boolean; data: RevenueDataPoint[] }>(
    `/ai/revenue?period=${period}`,
  );
  return res.data.data;
}

export async function getVehicleFinanceApi(filters: VehicleFinanceFilters): Promise<VehicleFinanceDataPoint[]> {
  const params: Record<string, string> = {
    startDate: filters.startDate,
    endDate: filters.endDate,
  };
  if (filters.vehicleIds.length > 0) {
    params.vehicleIds = filters.vehicleIds.join(',');
  }
  const res = await apiClient.get<{ success: boolean; data: VehicleFinanceDataPoint[] }>(
    '/ai/vehicle-finance',
    { params },
  );
  return res.data.data;
}
