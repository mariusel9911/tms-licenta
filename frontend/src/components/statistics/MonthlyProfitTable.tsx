import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { MonthlyRevenuePoint } from '@/types/statistics.types';

interface Props {
  data: MonthlyRevenuePoint[];
}

function fmtEur(n: number) {
  return `€${n.toLocaleString('en-EU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function RevenueBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[72px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-[width] duration-500 ease-out-expo"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

function MarginBar({ value }: { value: number }) {
  const capped = Math.min(Math.max(value, 0), 100);
  // Color thresholds: green ≥ 20%, amber 10–20%, red < 10%
  const color =
    value >= 20 ? '#10b981' :
    value >= 10 ? '#f59e0b' :
                  '#ef4444';
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out-expo"
          style={{ width: `${capped}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs tabular-nums w-10 text-right font-medium" style={{ color }}>
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

export function MonthlyProfitTable({ data }: Props) {
  if (!data.length) return null;

  // Newest first
  const rows = [...data].sort((a, b) => b.month.localeCompare(a.month));
  const maxRevenue = Math.max(...rows.map((r) => r.revenue));

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalProfit = data.reduce((s, d) => s + d.profit, 0);
  const totalCost = totalRevenue - totalProfit;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Monthly Profit Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="p-0 pb-2">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="hidden sm:table-cell">Revenue share</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="hidden sm:table-cell">Margin</TableHead>
                <TableHead className="text-right">Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => {
                const cost = row.revenue - row.profit;
                const margin = row.revenue > 0 ? (row.profit / row.revenue) * 100 : 0;
                const isPositive = row.profit >= 0;

                const prevRow = rows[i + 1];
                const trendPct =
                  prevRow && prevRow.profit > 0
                    ? ((row.profit - prevRow.profit) / prevRow.profit) * 100
                    : null;

                return (
                  <TableRow key={row.month} className="hover:bg-muted/40">
                    <TableCell className="font-medium">{row.month}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtEur(row.revenue)}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <RevenueBar value={row.revenue} max={maxRevenue} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {fmtEur(cost)}
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums font-semibold ${
                        isPositive ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      <span className="inline-flex items-center justify-end gap-1">
                        {!isPositive && <TrendingDown className="h-3 w-3 shrink-0" />}
                        {fmtEur(row.profit)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <MarginBar value={margin} />
                    </TableCell>
                    <TableCell className="text-right">
                      {trendPct !== null ? (
                        <span
                          className={`inline-flex items-center gap-0.5 text-xs ${
                            trendPct >= 0 ? 'text-emerald-600' : 'text-red-500'
                          }`}
                        >
                          {trendPct >= 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {trendPct >= 0 ? '+' : ''}
                          {trendPct.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            {/* Totals footer */}
            <TableFooter>
              <TableRow className="border-t-2">
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {fmtEur(totalRevenue)}
                </TableCell>
                <TableCell className="hidden sm:table-cell" />
                <TableCell className="text-right font-semibold text-muted-foreground tabular-nums">
                  {fmtEur(totalCost)}
                </TableCell>
                <TableCell className="text-right font-semibold text-emerald-600 tabular-nums">
                  {fmtEur(totalProfit)}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <MarginBar value={totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0} />
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
