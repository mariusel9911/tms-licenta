import { Package, TrendingUp, CalendarDays, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { StatisticsData } from '@/types/statistics.types';

interface Props {
  data: StatisticsData;
}

function fmt(n: number): string {
  return n.toLocaleString('en-EU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtEur(n: number): string {
  return `€${n.toLocaleString('en-EU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function StatsSummaryCards({ data }: Props) {
  const totalRevenue = Object.values(data.revenueByStatus).reduce((s, v) => s + v, 0);
  const marginAbs = data.avgClientPrice - data.avgTransporterPrice;
  const marginRate =
    totalRevenue > 0 ? Math.abs((marginAbs / totalRevenue) * 100).toFixed(1) : '0.0';

  const cards = [
    {
      title: 'Total Orders',
      value: fmt(data.totalOrders),
      sub: `${data.ordersThisWeek} this week · ${data.ordersThisMonth} this month`,
      icon: Package,
      accent: 'border-l-blue-500',
      iconBg: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
    },
    {
      title: 'Total Revenue',
      value: fmtEur(totalRevenue),
      sub: `Avg carrier fee: ${fmtEur(data.avgTransporterPrice)}`,
      icon: TrendingUp,
      accent: 'border-l-emerald-500',
      iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
    },
    {
      title: 'This Month',
      value: fmt(data.ordersThisMonth),
      sub: `${data.ordersThisWeek} orders this week`,
      icon: CalendarDays,
      accent: 'border-l-sky-500',
      iconBg: 'bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400',
    },
    {
      title: 'Avg Margin / Order',
      value: fmtEur(marginAbs),
      sub: `Rate: ${marginRate}% · carrier ${fmtEur(data.avgTransporterPrice)}`,
      icon: BarChart3,
      accent: 'border-l-amber-500',
      iconBg: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map(({ title, value, sub, icon: Icon, accent, iconBg }, index) => (
        <Card
          key={title}
          className={`border-l-4 ${accent} transition-shadow hover:shadow-md animate-in fade-in-0 slide-in-from-bottom-2 duration-300`}
          style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'backwards' }}
        >
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <div className={`p-2.5 rounded-lg ${iconBg}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
