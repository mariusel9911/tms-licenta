import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '@/api/client';
import { getStatisticsApi, getPredictionsApi, getRevenueApi, getVehicleFinanceApi } from '@/api/statistics.api';
import type { StatisticsData, PredictionData, VehicleFinanceDataPoint } from '@/types/statistics.types';

const mockGet = vi.mocked(apiClient.get);

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
  upperBound: [1200, 1400],
  lowerBound: [1000, 1200],
};

const mockRevenue = [
  { label: 'Mar 18', revenue: 1000, profit: 200 },
  { label: 'Mar 19', revenue: 1200, profit: 300 },
];

describe('statistics.api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getStatisticsApi ────────────────────────────────────────────────────────

  describe('getStatisticsApi()', () => {
    it('calls GET /ai/statistics and returns data', async () => {
      mockGet.mockResolvedValue({ data: { success: true, data: mockStats } });

      const result = await getStatisticsApi();

      expect(mockGet).toHaveBeenCalledWith('/ai/statistics');
      expect(result).toEqual(mockStats);
    });

    it('propagates rejection when apiClient throws', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      await expect(getStatisticsApi()).rejects.toThrow('Network error');
    });
  });

  // ── getPredictionsApi ───────────────────────────────────────────────────────

  describe('getPredictionsApi()', () => {
    it('calls /ai/predictions with timeframe param (no refresh)', async () => {
      mockGet.mockResolvedValue({ data: { success: true, data: mockPredictions } });

      const result = await getPredictionsApi('day');

      expect(mockGet).toHaveBeenCalledWith('/ai/predictions?timeframe=day');
      expect(result).toEqual(mockPredictions);
    });

    it('adds refresh=true param when refresh flag is set', async () => {
      mockGet.mockResolvedValue({ data: { success: true, data: mockPredictions } });

      await getPredictionsApi('week', true);

      expect(mockGet).toHaveBeenCalledWith('/ai/predictions?timeframe=week&refresh=true');
    });

    it('does not add refresh param when refresh=false (default)', async () => {
      mockGet.mockResolvedValue({ data: { success: true, data: mockPredictions } });

      await getPredictionsApi('month', false);

      const calledUrl = mockGet.mock.calls[0][0] as string;
      expect(calledUrl).not.toContain('refresh');
    });

    it('propagates rejection on error', async () => {
      mockGet.mockRejectedValue(new Error('timeout'));

      await expect(getPredictionsApi('day')).rejects.toThrow('timeout');
    });
  });

  // ── getRevenueApi ───────────────────────────────────────────────────────────

  describe('getRevenueApi()', () => {
    it('calls /ai/revenue?period=day and returns array', async () => {
      mockGet.mockResolvedValue({ data: { success: true, data: mockRevenue } });

      const result = await getRevenueApi('day');

      expect(mockGet).toHaveBeenCalledWith('/ai/revenue?period=day');
      expect(result).toEqual(mockRevenue);
    });

    it('passes each valid period correctly', async () => {
      mockGet.mockResolvedValue({ data: { success: true, data: [] } });

      for (const period of ['day', 'week', 'month', 'year', 'all'] as const) {
        mockGet.mockClear();
        await getRevenueApi(period);
        expect(mockGet).toHaveBeenCalledWith(`/ai/revenue?period=${period}`);
      }
    });

    it('propagates rejection on error', async () => {
      mockGet.mockRejectedValue(new Error('500'));

      await expect(getRevenueApi('year')).rejects.toThrow('500');
    });
  });

  // ── getVehicleFinanceApi ────────────────────────────────────────────────────

  describe('getVehicleFinanceApi()', () => {
    const mockFinance: VehicleFinanceDataPoint[] = [
      { label: 'Truck ABC-123', transporterPrice: 5000, clientPrice: 3500, profit: 1500 },
    ];

    it('calls GET /ai/vehicle-finance with date params only when vehicleIds is empty', async () => {
      mockGet.mockResolvedValue({ data: { success: true, data: [] } });

      const result = await getVehicleFinanceApi({
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        vehicleIds: [],
      });

      expect(mockGet).toHaveBeenCalledWith('/ai/vehicle-finance', {
        params: { startDate: '2026-01-01', endDate: '2026-03-31' },
      });
      expect(result).toEqual([]);
    });

    it('includes comma-separated vehicleIds param when provided', async () => {
      mockGet.mockResolvedValue({ data: { success: true, data: mockFinance } });

      const result = await getVehicleFinanceApi({
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        vehicleIds: [1, 2, 3],
      });

      expect(mockGet).toHaveBeenCalledWith('/ai/vehicle-finance', {
        params: { startDate: '2026-01-01', endDate: '2026-03-31', vehicleIds: '1,2,3' },
      });
      expect(result).toEqual(mockFinance);
    });

    it('handles single vehicleId', async () => {
      mockGet.mockResolvedValue({ data: { success: true, data: mockFinance } });

      await getVehicleFinanceApi({ startDate: '2026-01-01', endDate: '2026-03-31', vehicleIds: [7] });

      expect(mockGet).toHaveBeenCalledWith('/ai/vehicle-finance', {
        params: { startDate: '2026-01-01', endDate: '2026-03-31', vehicleIds: '7' },
      });
    });

    it('propagates rejection on error', async () => {
      mockGet.mockRejectedValue(new Error('timeout'));

      await expect(
        getVehicleFinanceApi({ startDate: '2026-01-01', endDate: '2026-03-31', vehicleIds: [] }),
      ).rejects.toThrow('timeout');
    });
  });
});
