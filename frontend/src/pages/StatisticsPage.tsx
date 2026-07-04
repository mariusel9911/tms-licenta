import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TrendingUp, Brain, LayoutList, Car, type LucideIcon } from 'lucide-react';
import { useStatistics, usePredictions } from '@/hooks/useStatistics';
import { useSettings } from '@/hooks/useSettings';
import { getPredictionsApi } from '@/api/statistics.api';
import { StatsSummaryCards } from '@/components/statistics/StatsSummaryCards';
import { RevenueLineChart } from '@/components/statistics/RevenueLineChart';
import { MonthlyProfitTable } from '@/components/statistics/MonthlyProfitTable';
import { ProfitPredictionChart } from '@/components/statistics/ProfitPredictionChart';
import { StatusDistribution } from '@/components/statistics/StatusDistribution';
import { TopClientsChart } from '@/components/statistics/TopClientsChart';
import { PredictionControls } from '@/components/statistics/PredictionControls';
import { VehicleFinanceCard } from '@/components/statistics/VehicleFinanceCard';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { PredictionTimeframe } from '@/types/statistics.types';

interface SectionDividerProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
}

function SectionDivider({ title, description, icon: Icon }: SectionDividerProps) {
  return (
    <div className="flex items-center gap-3 pt-2 animate-in fade-in-0 slide-in-from-left-2 duration-300">
      {Icon && (
        <div className="shrink-0 p-1.5 rounded-md bg-muted/70">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}
      <div className="shrink-0">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

export default function StatisticsPage() {
  const [timeframe, setTimeframe] = useState<PredictionTimeframe>('month');
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useStatistics();
  const { data: predictions, isFetching: predFetching, isLoading: predLoading, isError: predError } = usePredictions(timeframe);
  const { data: appSettings } = useSettings();
  // Default to showing while settings load to avoid layout shift
  const predictionEnabled = appSettings?.aiPredictionEnabled !== false;

  function handleRefresh() {
    // Fetch fresh predictions bypassing backend cache, then update React Query cache
    void getPredictionsApi(timeframe, true).then((fresh) => {
      queryClient.setQueryData(['predictions', timeframe], fresh);
    });
    void queryClient.invalidateQueries({ queryKey: ['statistics'] });
  }

  if (statsLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
                <Skeleton className="h-7 w-32 mb-2" />
                <Skeleton className="h-3 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardContent className="pt-5">
              <Skeleton className="h-56 w-full rounded-md" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <Skeleton className="h-56 w-full rounded-md" />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardContent className="pt-5">
            <Skeleton className="h-72 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-400 px-2.5 py-1 rounded-full border border-indigo-200/60 dark:border-indigo-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            AI-Powered
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Statistics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Order analytics and AI profit predictions
        </p>
      </div>

      {/* KPI cards */}
      <StatsSummaryCards data={stats} />

      {/* Revenue Trends */}
      <SectionDivider title="Revenue Trends" description="Income and status breakdown across selected periods" icon={TrendingUp} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueLineChart />
        </div>
        <StatusDistribution revenueByStatus={stats.revenueByStatus} />
      </div>

      {/* Vehicle Finance */}
      <SectionDivider title="Vehicle Finance" description="Revenue and cost breakdown filtered by vehicle and date range" icon={Car} />
      <VehicleFinanceCard />

      {/* AI Forecast */}
      {predictionEnabled && (
        <>
          <SectionDivider title="AI Profit Forecast" description="Machine-learning predictions powered by your historical order data" icon={Brain} />
          <div className="space-y-3">
            <PredictionControls
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              onRefresh={handleRefresh}
              isRefreshing={predFetching}
            />
            <ProfitPredictionChart data={predictions ?? { timeframe, labels: [], historical: [], predicted: [] }} serviceOffline={predError} isLoading={predLoading} />
          </div>
        </>
      )}

      {/* Breakdown */}
      <SectionDivider title="Detailed Breakdown" description="Month-by-month performance and top partners" icon={LayoutList} />
      <MonthlyProfitTable data={stats.monthlyRevenue} />
      <TopClientsChart
        clients={stats.topClients}
        transporters={stats.topTransporters}
      />
    </div>
  );
}
