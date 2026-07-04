export interface MonthlyRevenuePoint {
  month: string;
  revenue: number;
  profit: number;
}

export interface TopPartner {
  name: string;
  orderCount: number;
}

export interface StatisticsData {
  totalOrders: number;
  ordersThisMonth: number;
  ordersThisWeek: number;
  revenueByStatus: Record<string, number>;
  monthlyRevenue: MonthlyRevenuePoint[];
  topClients: TopPartner[];
  topTransporters: TopPartner[];
  avgClientPrice: number;
  avgTransporterPrice: number;
}

export interface PredictionData {
  timeframe: string;
  labels: string[];
  historical: number[];
  predicted: number[];
  upperBound?: number[];
  lowerBound?: number[];
}

export type PredictionTimeframe = 'day' | 'week' | 'month';

export type RevenueViewPeriod = 'day' | 'week' | 'month' | 'year' | 'all';

export interface RevenueDataPoint {
  label: string;
  revenue: number;
  profit: number;
}

export interface VehicleFinanceDataPoint {
  label: string;
  clientPrice: number;      // revenue received from the client
  transporterPrice: number; // cost paid to the transporter
  profit: number;           // clientPrice - transporterPrice
}

export interface VehicleFinanceFilters {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  vehicleIds: number[];
}
