import { Fragment } from 'react';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { PredictionData } from '@/types/statistics.types';

// ── Colors ──────────────────────────────────────────────────────────────────
const COLOR_ACTUAL    = '#10b981'; // emerald-500
const COLOR_PREDICTED = '#6366f1'; // indigo-500

// ── Types ────────────────────────────────────────────────────────────────────
interface Props {
  data: PredictionData;
  serviceOffline?: boolean;
  isLoading?: boolean;
}

interface ChartPoint {
  label: string;
  historical: number | null;
  predicted: number | null;
  upperBound: number | null;
  lowerBound: number | null;
}

// ── Data builders ────────────────────────────────────────────────────────────

function buildChartData(data: PredictionData): { points: ChartPoint[]; boundaryLabel: string | null } {
  const nHistorical = data.historical.length;
  const nPredicted  = data.predicted.length;
  const points: ChartPoint[] = [];

  for (let i = 0; i < nHistorical; i++) {
    points.push({
      label: data.labels[i] ?? `P${i}`,
      historical: data.historical[i],
      predicted: null,
      upperBound: null,
      lowerBound: null,
    });
  }

  const boundaryLabel = nHistorical > 0 ? (data.labels[nHistorical - 1] ?? null) : null;

  // Overlap: set predicted = actual on the last historical point for visual line continuity
  if (nHistorical > 0 && nPredicted > 0) {
    points[nHistorical - 1].predicted = data.historical[nHistorical - 1];
    // Also set bounds at boundary for continuity
    points[nHistorical - 1].upperBound = data.historical[nHistorical - 1];
    points[nHistorical - 1].lowerBound = data.historical[nHistorical - 1];
  }

  // Future points — predicted[0] maps to labels[nHistorical]
  for (let i = 0; i < nPredicted; i++) {
    points.push({
      label: data.labels[nHistorical + i] ?? `F${i + 1}`,
      historical: null,
      predicted: data.predicted[i],
      upperBound: data.upperBound?.[i] ?? null,
      lowerBound: data.lowerBound?.[i] ?? null,
    });
  }

  return { points, boundaryLabel };
}

interface TableRowData {
  label: string;
  actual: number | null;
  predicted: number | null;
}

function buildTableRows(data: PredictionData): TableRowData[] {
  const nHistorical = data.historical.length;
  const nPredicted  = data.predicted.length;

  return data.labels.map((label, i) => {
    const actual       = i < nHistorical ? data.historical[i] : null;
    const predictedIdx = i - nHistorical;
    const predicted    = predictedIdx >= 0 && predictedIdx < nPredicted
      ? data.predicted[predictedIdx]
      : null;
    return { label, actual, predicted };
  });
}

// ── Chart config (for legend) ─────────────────────────────────────────────────
const chartConfig = {
  historical: { label: 'Actual profit',    color: COLOR_ACTUAL },
  predicted:  { label: 'Predicted profit', color: COLOR_PREDICTED },
} satisfies ChartConfig;

// ── Tooltip ───────────────────────────────────────────────────────────────────
interface TooltipPayloadItem {
  name: string;
  value: number | null;
  color?: string;
}
interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function PredictionTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;

  const items = payload.filter(
    (p) => (p.name === 'historical' || p.name === 'predicted') && p.value != null,
  );
  if (!items.length) return null;

  return (
    <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-lg text-sm">
      <div className="text-xs text-muted-foreground mb-1.5">{label}</div>
      {items.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: item.color }} />
          <span className="text-muted-foreground capitalize">
            {item.name === 'historical' ? 'Actual' : 'Predicted'}:
          </span>
          <span className="font-bold">
            €{item.value!.toLocaleString('en-EU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtEur(n: number) {
  return `€${n.toLocaleString('en-EU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ProfitPredictionChart({ data, serviceOffline, isLoading }: Props) {
  const hasHistorical = data.historical.length > 0;
  const hasPredicted  = data.predicted.length > 0;
  const hasBands      = !!(data.upperBound?.length && data.lowerBound?.length);

  if (isLoading || (!hasHistorical && !serviceOffline)) {
    // Still loading or genuinely no data yet (service is up but no orders exist)
    if (isLoading) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profit Forecast</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Loading predictions…
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profit Forecast</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          No data found yet for predictions — add orders to get started
        </CardContent>
      </Card>
    );
  }

  if (!hasHistorical && serviceOffline) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profit Forecast</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          Start the Python AI service to enable profit predictions
        </CardContent>
      </Card>
    );
  }

  const { points, boundaryLabel } = buildChartData(data);
  const tableRows = buildTableRows(data);

  const totalActual    = tableRows.reduce((s, r) => s + (r.actual    ?? 0), 0);
  const totalPredicted = tableRows.reduce((s, r) => s + (r.predicted ?? 0), 0);
  const totalForecast  = tableRows.reduce((s, r) => s + (r.actual ?? r.predicted ?? 0), 0);

  // When all values are negative the Recharts Area fills *upward* to y=0, making
  // the gradient appear backwards (dark at zero, transparent at the line).
  // Flip the gradient direction so it always fades *away* from the data line.
  const historicalAllNegative = data.historical.length > 0 && data.historical.every((v) => v < 0);
  const predictedAllNegative  = data.predicted.length  > 0 && data.predicted.every((v)  => v < 0);

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Profit Forecast — {data.timeframe}</CardTitle>
        <div className="flex items-center gap-2">
          {hasBands && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
              95% confidence band
            </span>
          )}
          {!hasPredicted && (
            <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-md">
              Python AI offline — showing historical only
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Chart */}
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <ComposedChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {/* y1/y2 flipped when all values are negative so gradient fades away from the line */}
              <linearGradient id="gradHistorical" x1="0" y1={historicalAllNegative ? '1' : '0'} x2="0" y2={historicalAllNegative ? '0' : '1'}>
                <stop offset="5%"  stopColor={COLOR_ACTUAL} stopOpacity={0.18} />
                <stop offset="95%" stopColor={COLOR_ACTUAL} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradPredicted" x1="0" y1={predictedAllNegative ? '1' : '0'} x2="0" y2={predictedAllNegative ? '0' : '1'}>
                <stop offset="5%"  stopColor={COLOR_PREDICTED} stopOpacity={0.18} />
                <stop offset="95%" stopColor={COLOR_PREDICTED} stopOpacity={0} />
              </linearGradient>
              <filter id="dotShadow">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.4)" />
              </filter>
            </defs>

            <CartesianGrid strokeDasharray="4 12" vertical={false} strokeOpacity={0.35} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickMargin={8} angle={-25} textAnchor="end" height={50} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `€${(v / 1000).toFixed(0)}k`}
            />

            <Tooltip content={<PredictionTooltip />} cursor={{ strokeDasharray: '3 3' }} />

            <ChartLegend content={<ChartLegendContent />} />

            {boundaryLabel && (
              <ReferenceLine
                x={boundaryLabel}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 2"
                strokeOpacity={0.5}
                label={{ value: 'Today', position: 'insideTopRight', fontSize: 10 }}
              />
            )}

            {/* Confidence band — thin dashed boundary lines */}
            <Line
              type="monotone"
              dataKey="upperBound"
              stroke={COLOR_PREDICTED}
              strokeWidth={1}
              strokeDasharray="4 4"
              strokeOpacity={0.4}
              dot={false}
              activeDot={false}
              legendType="none"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="lowerBound"
              stroke={COLOR_PREDICTED}
              strokeWidth={1}
              strokeDasharray="4 4"
              strokeOpacity={0.4}
              dot={false}
              activeDot={false}
              legendType="none"
              connectNulls
            />

            {/* Historical — area with gradient fill */}
            <Area
              type="monotone"
              dataKey="historical"
              stroke={COLOR_ACTUAL}
              strokeWidth={2.5}
              fill="url(#gradHistorical)"
              dot={false}
              connectNulls
              activeDot={{ r: 5, fill: COLOR_ACTUAL, stroke: 'white', strokeWidth: 2, filter: 'url(#dotShadow)' }}
            />

            {/* Predicted — area with gradient fill, same style as historical */}
            <Area
              type="monotone"
              dataKey="predicted"
              stroke={COLOR_PREDICTED}
              strokeWidth={2.5}
              strokeDasharray="0"
              fill="url(#gradPredicted)"
              dot={{ r: 3, fill: COLOR_PREDICTED, stroke: 'white', strokeWidth: 1.5 }}
              connectNulls
              activeDot={{ r: 5, fill: COLOR_PREDICTED, stroke: 'white', strokeWidth: 2, filter: 'url(#dotShadow)' }}
            />
          </ComposedChart>
        </ChartContainer>

      </CardContent>
    </Card>

    {/* ── Forecast data table — separate card ─────────────────────────────── */}
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight">Forecast Data</CardTitle>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">{data.timeframe}</p>
          </div>
        </div>

        {/* KPI summary strip */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-lg border border-border/60 p-3.5">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: COLOR_ACTUAL }} />
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/55">Actual</span>
            </div>
            <div className="text-base font-bold tabular-nums" style={{ color: COLOR_ACTUAL }}>
              {totalActual !== 0 ? fmtEur(totalActual) : <span className="text-muted-foreground/30 text-sm">—</span>}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 p-3.5">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: COLOR_PREDICTED }} />
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/55">Forecast</span>
            </div>
            <div className="text-base font-bold tabular-nums" style={{ color: COLOR_PREDICTED }}>
              {totalPredicted !== 0 ? fmtEur(totalPredicted) : <span className="text-muted-foreground/30 text-sm">—</span>}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3.5">
            <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/55 mb-2">Period Total</div>
            <div className="text-base font-bold tabular-nums text-foreground">
              {fmtEur(totalForecast)}
            </div>
          </div>
        </div>
      </CardHeader>

      <div className="h-px bg-border/50 mx-6" />

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="pl-6 py-3 w-36 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/45">
                  Period
                </TableHead>
                <TableHead className="py-3 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground/45">
                  <span className="inline-flex items-center justify-end gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: COLOR_ACTUAL }} />
                    Actual Profit
                  </span>
                </TableHead>
                <TableHead className="pr-6 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground/45">
                  <span className="inline-flex items-center justify-end gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: COLOR_PREDICTED }} />
                    Forecast
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.map((row, idx) => {
                const isForecast = row.actual === null && row.predicted !== null;
                const isFirstForecast =
                  isForecast &&
                  (idx === 0 || !(tableRows[idx - 1].actual === null && tableRows[idx - 1].predicted !== null));
                const isAbove = row.actual !== null && row.predicted !== null && row.actual >= row.predicted;

                return (
                  <Fragment key={row.label}>
                    {/* Section divider between historical and forecast rows */}
                    {isFirstForecast && (
                      <TableRow className="hover:bg-transparent border-none">
                        <TableCell colSpan={3} className="py-1.5 px-0">
                          <div className="flex items-center gap-3 px-6">
                            <div className="flex-1 h-px bg-border/60" />
                            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground/40 px-1">
                              Forecast
                            </span>
                            <div className="flex-1 h-px bg-border/60" />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}

                    <TableRow className="hover:bg-muted/25 transition-colors">
                      {/* Period */}
                      <TableCell className={`pl-6 py-2.5 text-xs font-medium ${isForecast ? 'text-muted-foreground/55' : 'text-foreground/75'}`}>
                        {row.label}
                      </TableCell>

                      {/* Actual profit + trend icon */}
                      <TableCell className="py-2.5 text-right tabular-nums">
                        {row.actual !== null ? (
                          <span className="inline-flex items-center justify-end gap-1.5">
                            <span className="font-semibold text-[13px]" style={{ color: COLOR_ACTUAL }}>
                              {fmtEur(row.actual)}
                            </span>
                            {row.predicted !== null && (
                              isAbove
                                ? <TrendingUp  className="h-3 w-3 shrink-0 text-emerald-500/60" />
                                : <TrendingDown className="h-3 w-3 shrink-0 text-amber-500/60" />
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/25 text-xs">—</span>
                        )}
                      </TableCell>

                      {/* Forecast profit */}
                      <TableCell className="pr-6 py-2.5 text-right tabular-nums">
                        {row.predicted !== null ? (
                          <span className="font-semibold text-[13px]" style={{ color: COLOR_PREDICTED }}>
                            {fmtEur(row.predicted)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/25 text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })}
            </TableBody>

            <TableFooter>
              <TableRow className="border-t-2 border-border/50 hover:bg-transparent">
                <TableCell className="pl-6 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/55">
                  Totals
                </TableCell>
                <TableCell className="py-3 text-right tabular-nums font-bold text-[13px]" style={{ color: COLOR_ACTUAL }}>
                  {totalActual !== 0 ? fmtEur(totalActual) : '—'}
                </TableCell>
                <TableCell className="pr-6 py-3 text-right tabular-nums font-bold text-[13px]" style={{ color: COLOR_PREDICTED }}>
                  {totalPredicted !== 0 ? fmtEur(totalPredicted) : '—'}
                </TableCell>
              </TableRow>
              <TableRow className="bg-muted/30 hover:bg-muted/40 transition-colors">
                <TableCell className="pl-6 py-4 text-xs font-bold uppercase tracking-wide text-muted-foreground/60">
                  Period Total
                </TableCell>
                <TableCell colSpan={2} className="pr-6 py-4 text-right">
                  <span className="text-xl font-bold tabular-nums text-foreground">
                    {fmtEur(totalForecast)}
                  </span>
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
    </>
  );
}
