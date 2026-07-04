import { useQuery } from '@tanstack/react-query';
import { getStatisticsApi, getPredictionsApi, getRevenueApi, getVehicleFinanceApi } from '@/api/statistics.api';
import type { PredictionTimeframe, RevenueViewPeriod, VehicleFinanceFilters } from '@/types/statistics.types';

export function useStatistics() {
  return useQuery({
    queryKey: ['statistics'],
    queryFn: getStatisticsApi,
    staleTime: 1000 * 60 * 2,
  });
}

export function usePredictions(timeframe: PredictionTimeframe) {
  return useQuery({
    queryKey: ['predictions', timeframe],
    queryFn: () => getPredictionsApi(timeframe),
    staleTime: 1000 * 60 * 5,
  });
}

export function useRevenue(period: RevenueViewPeriod) {
  return useQuery({
    queryKey: ['revenue', period],
    queryFn: () => getRevenueApi(period),
    staleTime: 1000 * 60 * 2,
  });
}

export function useVehicleFinance(filters: VehicleFinanceFilters) {
  return useQuery({
    queryKey: ['vehicle-finance', filters],
    queryFn: () => getVehicleFinanceApi(filters),
    staleTime: 1000 * 60 * 2,
    enabled: filters.vehicleIds.length > 0,
  });
}
