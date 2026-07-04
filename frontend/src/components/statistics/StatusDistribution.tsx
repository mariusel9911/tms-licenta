import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ── Domain data ───────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  DRAFT:       '#94a3b8',
  CONFIRMED:   '#3b82f6',
  IN_PROGRESS: '#f59e0b',
  COMPLETED:   '#22c55e',
  CANCELLED:   '#ef4444',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT:       'Draft',
  CONFIRMED:   'Confirmed',
  IN_PROGRESS: 'In Progress',
  COMPLETED:   'Delivered',
  CANCELLED:   'Cancelled',
};

// ── Props & helpers ───────────────────────────────────────────────────────────
interface Props {
  revenueByStatus: Record<string, number>;
}

function fmtEur(n: number) {
  return `€${n.toLocaleString('en-EU', { maximumFractionDigits: 0 })}`;
}

function fmtEurShort(n: number) {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `€${(n / 1_000).toFixed(0)}k`;
  return fmtEur(n);
}

// ── Donut constants ───────────────────────────────────────────────────────────
const SIZE         = 200;
const STROKE       = 28;
const RADIUS       = SIZE / 2 - STROKE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ── Component ─────────────────────────────────────────────────────────────────
export function StatusDistribution({ revenueByStatus }: Props) {
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);

  const entries = Object.entries(revenueByStatus).filter(([, v]) => v > 0);

  if (!entries.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue by Status</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          No data available yet
        </CardContent>
      </Card>
    );
  }

  const chartData = entries.map(([status, value]) => ({
    name:   STATUS_LABELS[status] ?? status.replace(/_/g, ' '),
    value:  Math.round(value),
    status,
    color:  STATUS_COLORS[status] ?? '#6b7280',
  }));

  const total = chartData.reduce((s, d) => s + d.value, 0);
  const isAnyHovered = hoveredStatus !== null;

  // Build segment geometry
  let cumulativePct = 0;
  const segments = chartData.map((d) => {
    const pct    = d.value / total;
    const dash   = pct * CIRCUMFERENCE;
    const offset = cumulativePct * CIRCUMFERENCE;
    cumulativePct += pct;
    return { ...d, pct, dash, offset };
  });

  const active = segments.find(s => s.status === hoveredStatus);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Revenue by Status</CardTitle>
        <span className="text-xl font-bold tabular-nums">{fmtEurShort(total)}</span>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center gap-6">

          {/* ── Donut SVG ──────────────────────────────────────────────────── */}
          <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
            <svg
              width={SIZE}
              height={SIZE}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className="-rotate-90"
            >
              {/* Background track */}
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="transparent"
                strokeWidth={STROKE}
                className="stroke-muted/30"
              />

              {/* Data segments */}
              {segments.map((seg) => {
                const isActive = hoveredStatus === seg.status;
                return (
                  <circle
                    key={seg.status}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="transparent"
                    stroke={seg.color}
                    strokeWidth={isActive ? STROKE + 5 : STROKE}
                    strokeDasharray={`${seg.dash} ${CIRCUMFERENCE}`}
                    strokeDashoffset={-seg.offset}
                    strokeLinecap="butt"
                    className="cursor-pointer transition-[stroke-width,opacity] duration-200"
                    style={{ opacity: isAnyHovered && !isActive ? 0.25 : 1 }}
                    onMouseEnter={() => setHoveredStatus(seg.status)}
                    onMouseLeave={() => setHoveredStatus(null)}
                  />
                );
              })}
            </svg>

            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active?.status ?? 'total'}
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.88 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col items-center text-center px-3"
                >
                  <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                    {active?.name ?? 'Total'}
                  </span>
                  <span className="text-lg font-bold tabular-nums leading-tight">
                    {fmtEurShort(active?.value ?? total)}
                  </span>
                  {active && (
                    <span className="text-xs text-muted-foreground">
                      {(active.pct * 100).toFixed(0)}%
                    </span>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* ── Legend ─────────────────────────────────────────────────────── */}
          <div className="flex-1 w-full space-y-0.5">
            {segments.map((seg, i) => {
              const isActive = hoveredStatus === seg.status;
              return (
                <motion.div
                  key={seg.status}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                  className={`flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-[background-color,opacity] duration-150 ${
                    isActive
                      ? 'bg-muted'
                      : isAnyHovered
                        ? 'opacity-25'
                        : 'hover:bg-muted/50'
                  }`}
                  onMouseEnter={() => setHoveredStatus(seg.status)}
                  onMouseLeave={() => setHoveredStatus(null)}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-sm text-muted-foreground flex-1">{seg.name}</span>
                  <span className="text-sm font-semibold tabular-nums">{fmtEur(seg.value)}</span>
                  <span className="text-xs text-muted-foreground tabular-nums w-8 text-right shrink-0">
                    {(seg.pct * 100).toFixed(0)}%
                  </span>
                </motion.div>
              );
            })}
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
