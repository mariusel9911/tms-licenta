import { useState } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Area } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import { useRevenue } from '@/hooks/useStatistics';
import type { RevenueDataPoint, RevenueViewPeriod } from '@/types/statistics.types';

const PERIODS: { value: RevenueViewPeriod; label: string; description: string }[] = [
  { value: 'day', label: 'Day', description: 'Last 7 days' },
  { value: 'week', label: 'Week', description: 'Last 30 days (weekly)' },
  { value: 'month', label: 'Month', description: 'Last 90 days (monthly)' },
  { value: 'year', label: 'Year', description: 'Last 12 months' },
  { value: 'all', label: 'All Time', description: 'All data (quarterly)' },
];

const COLOR_REVENUE = '#10b981'; // emerald-500

const chartConfig = {
  revenue: { label: 'Revenue', color: COLOR_REVENUE },
} satisfies ChartConfig;

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: RevenueDataPoint }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <div className="text-xs text-muted-foreground mb-1">{d.label}</div>
      <div className="text-sm font-bold">
        €{d.revenue.toLocaleString('en-EU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">
        Profit: €{d.profit.toLocaleString('en-EU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </div>
    </div>
  );
}

function fmtK(n: number) {
  return `€${(n / 1000).toFixed(0)}k`;
}

function PeriodSelector({
  period,
  onPeriodChange,
}: {
  period: RevenueViewPeriod;
  onPeriodChange: (p: RevenueViewPeriod) => void;
}) {
  return (
    <div className="flex rounded-md border overflow-hidden shrink-0">
      {PERIODS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onPeriodChange(value)}
          className={cn(
            'cursor-pointer px-2.5 py-1 text-xs font-medium transition-colors',
            period === value
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-muted-foreground hover:bg-muted',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function RevenueLineChart() {
  const [period, setPeriod] = useState<RevenueViewPeriod>('month');
  const { data = [], isLoading } = useRevenue(period);

  const periodInfo = PERIODS.find((p) => p.value === period)!;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground text-sm pt-6">
          Loading…
        </CardContent>
      </Card>
    );
  }

  if (!data.length) {
    return (
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <p className="text-sm text-muted-foreground font-medium">Revenue — {periodInfo.description}</p>
            <PeriodSelector period={period} onPeriodChange={setPeriod} />
          </div>
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            No revenue data for this period
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const pctChange = prev && prev.revenue > 0 ? ((last.revenue - prev.revenue) / prev.revenue) * 100 : 0;
  const highPoint = data.reduce((m, d) => (d.revenue > m.revenue ? d : m), data[0]);
  const lowPoint = data.reduce((m, d) => (d.revenue < m.revenue ? d : m), data[0]);
  const isUp = pctChange >= 0;

  // Show all ticks — data points are now sparse enough per period
  const tickInterval = period === 'year' ? 1 : 0;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-5">
        {/* Header row */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-muted-foreground font-medium">Revenue — {periodInfo.description}</p>
          <PeriodSelector period={period} onPeriodChange={setPeriod} />
        </div>

        {/* Total + % change */}
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-3xl font-bold">
            €{totalRevenue.toLocaleString('en-EU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
          {prev && (
            <div className={`flex items-center gap-1 text-sm ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
              {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span className="font-medium">
                {isUp ? '+' : ''}
                {pctChange.toFixed(1)}%
              </span>
              <span className="text-muted-foreground font-normal">vs prev period</span>
            </div>
          )}
        </div>

        {/* High / low */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Latest:</span>
            <span className="font-semibold">
              €{last.revenue.toLocaleString('en-EU', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="flex items-center gap-4 text-muted-foreground text-xs">
            <span>
              High: <span className="text-sky-600 font-medium">{highPoint.label} {fmtK(highPoint.revenue)}</span>
            </span>
            <span>
              Low: <span className="text-amber-600 font-medium">{lowPoint.label} {fmtK(lowPoint.revenue)}</span>
            </span>
          </div>
        </div>

        {/* Chart */}
        <ChartContainer
          key={period}
          config={chartConfig}
          className="h-[220px] w-full [&_.recharts-curve.recharts-tooltip-cursor]:stroke-initial"
        >
          <ComposedChart data={data} margin={{ top: 20, right: 10, left: 5, bottom: 10 }}>
            <defs>
              <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLOR_REVENUE} stopOpacity={0.2} />
                <stop offset="95%" stopColor={COLOR_REVENUE} stopOpacity={0} />
              </linearGradient>
              <filter id="revLineShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="4" stdDeviation="10" floodColor={COLOR_REVENUE} floodOpacity="0.2" />
              </filter>
              <filter id="revDotShadow">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.5)" />
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="4 8" vertical={false} strokeOpacity={0.4} />
            {data.length > 1 && (
              <ReferenceLine
                x={highPoint.label}
                stroke={COLOR_REVENUE}
                strokeDasharray="4 4"
                strokeWidth={1}
                strokeOpacity={0.5}
              />
            )}
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10 }}
              tickMargin={10}
              interval={tickInterval}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}k`}
            />
            <ChartTooltip
              content={<CustomTooltip />}
              cursor={{ strokeDasharray: '3 3', stroke: 'hsl(var(--muted-foreground))', strokeOpacity: 0.5 }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="transparent"
              fill="url(#revGradient)"
              strokeWidth={0}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke={COLOR_REVENUE}
              strokeWidth={2.5}
              filter="url(#revLineShadow)"
              dot={(props: { cx: number; cy: number; payload: RevenueDataPoint }) => {
                const { cx, cy, payload } = props;
                const isSpecial = payload.label === highPoint.label || payload.label === lowPoint.label;
                if (isSpecial && data.length <= 30) {
                  return (
                    <circle
                      key={`dot-${payload.label}`}
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill={COLOR_REVENUE}
                      stroke="white"
                      strokeWidth={2}
                      filter="url(#revDotShadow)"
                    />
                  );
                }
                return <g key={`dot-${payload.label}`} />;
              }}
              activeDot={{
                r: 5,
                fill: COLOR_REVENUE,
                stroke: 'white',
                strokeWidth: 2,
                filter: 'url(#revDotShadow)',
              }}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
