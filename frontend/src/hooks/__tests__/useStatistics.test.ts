import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithProviders } from '@/__tests__/helpers/render';

vi.mock('@/api/statistics.api', () => ({
  getStatisticsApi: vi.fn(),
  getPredictionsApi: vi.fn(),
  getRevenueApi: vi.fn(),
  getVehicleFinanceApi: vi.fn(),
}));

import { getStatisticsApi, getPredictionsApi, getRevenueApi, getVehicleFinanceApi } from '@/api/statistics.api';
import { useStatistics, usePredictions, useRevenue, useVehicleFinance } from '../useStatistics';
import type { StatisticsData, PredictionData, RevenueDataPoint, VehicleFinanceDataPoint } from '@/types/statistics.types';

const mockGetStatistics = vi.mocked(getStatisticsApi);
const mockGetPredictions = vi.mocked(getPredictionsApi);
const mockGetRevenue = vi.mocked(getRevenueApi);
const mockGetVehicleFinance = vi.mocked(getVehicleFinanceApi);

const mockStats: StatisticsData = {
  totalOrders: 42,
  ordersThisMonth: 10,
  ordersThisWeek: 3,
  revenueByStatus: { COMPLETED: 5000 },
  monthlyRevenue: [{ month: '2026-03', revenue: 5000, profit: 1000 }],
  topClients: [{ name: 'Client A', orderCount: 10 }],
  topTransporters: [{ name: 'Carrier B', orderCount: 8 }],
  avgClientPrice: 1200,
  avgTransporterPrice: 900,
};

const mockPredictions: PredictionData = {
  timeframe: 'day',
  labels: ['Mar 18', 'Mar 19'],
  historical: [1000, 1200],
  predicted: [1100, 1300],
};

const mockRevenue: RevenueDataPoint[] = [
  { label: 'Mar 18', revenue: 1000, profit: 200 },
  { label: 'Mar 19', revenue: 1200, profit: 300 },
];

describe('useStatistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and returns statistics data', async () => {
    mockGetStatistics.mockResolvedValue(mockStats);

    const { result } = renderHookWithProviders(() => useStatistics());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockStats);
    expect(mockGetStatistics).toHaveBeenCalledTimes(1);
  });

  it('exposes error when fetch fails', async () => {
    mockGetStatistics.mockRejectedValue(new Error('Server error'));

    const { result } = renderHookWithProviders(() => useStatistics());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('usePredictions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches predictions for day timeframe', async () => {
    mockGetPredictions.mockResolvedValue(mockPredictions);

    const { result } = renderHookWithProviders(() => usePredictions('day'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockPredictions);
    expect(mockGetPredictions).toHaveBeenCalledWith('day');
  });

  it('fetches predictions for week timeframe', async () => {
    const weekPredictions = { ...mockPredictions, timeframe: 'week' };
    mockGetPredictions.mockResolvedValue(weekPredictions);

    const { result } = renderHookWithProviders(() => usePredictions('week'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetPredictions).toHaveBeenCalledWith('week');
  });

  it('fetches predictions for month timeframe', async () => {
    const monthPredictions = { ...mockPredictions, timeframe: 'month' };
    mockGetPredictions.mockResolvedValue(monthPredictions);

    const { result } = renderHookWithProviders(() => usePredictions('month'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetPredictions).toHaveBeenCalledWith('month');
  });

  it('exposes error when fetch fails', async () => {
    mockGetPredictions.mockRejectedValue(new Error('Python offline'));

    const { result } = renderHookWithProviders(() => usePredictions('day'));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useRevenue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches revenue for day period', async () => {
    mockGetRevenue.mockResolvedValue(mockRevenue);

    const { result } = renderHookWithProviders(() => useRevenue('day'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockRevenue);
    expect(mockGetRevenue).toHaveBeenCalledWith('day');
  });

  it('fetches revenue for week period', async () => {
    mockGetRevenue.mockResolvedValue(mockRevenue);

    const { result } = renderHookWithProviders(() => useRevenue('week'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetRevenue).toHaveBeenCalledWith('week');
  });

  it('fetches revenue for year period', async () => {
    mockGetRevenue.mockResolvedValue([]);

    const { result } = renderHookWithProviders(() => useRevenue('year'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetRevenue).toHaveBeenCalledWith('year');
  });

  it('fetches revenue for all period', async () => {
    mockGetRevenue.mockResolvedValue([]);

    const { result } = renderHookWithProviders(() => useRevenue('all'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGetRevenue).toHaveBeenCalledWith('all');
  });

  it('exposes error when fetch fails', async () => {
    mockGetRevenue.mockRejectedValue(new Error('Network error'));

    const { result } = renderHookWithProviders(() => useRevenue('month'));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useVehicleFinance', () => {
  const mockFilters = { startDate: '2026-01-01', endDate: '2026-03-31', vehicleIds: [1, 2] };
  const mockData: VehicleFinanceDataPoint[] = [
    { label: 'ABC-123', transporterPrice: 5000, clientPrice: 3500, profit: 1500 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches vehicle finance data when vehicleIds is non-empty', async () => {
    mockGetVehicleFinance.mockResolvedValue(mockData);

    const { result } = renderHookWithProviders(() => useVehicleFinance(mockFilters));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
    expect(mockGetVehicleFinance).toHaveBeenCalledWith(mockFilters);
  });

  it('is disabled when vehicleIds is empty (does not call API)', async () => {
    const emptyFilters = { ...mockFilters, vehicleIds: [] };

    const { result } = renderHookWithProviders(() => useVehicleFinance(emptyFilters));

    // Query is disabled so it stays in loading state without fetching
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGetVehicleFinance).not.toHaveBeenCalled();
  });

  it('exposes error when fetch fails', async () => {
    mockGetVehicleFinance.mockRejectedValue(new Error('Service unavailable'));

    const { result } = renderHookWithProviders(() => useVehicleFinance(mockFilters));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
