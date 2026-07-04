import { useState, useEffect } from 'react';
import { Users, Truck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TopPartner } from '@/types/statistics.types';

interface Props {
  clients: TopPartner[];
  transporters: TopPartner[];
}

const CLIENT_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd'];
const CARRIER_COLORS = ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'];

// Gold / Silver / Bronze for top 3 rank badges
const RANK_BADGE: Record<number, { bg: string; ring: string; text: string }> = {
  0: { bg: '#f59e0b', ring: '#fde68a', text: '#78350f' }, // gold
  1: { bg: '#94a3b8', ring: '#e2e8f0', text: '#1e293b' }, // silver
  2: { bg: '#cd7c3a', ring: '#fed7aa', text: '#431407' }, // bronze
};

function LeaderboardList({
  data,
  colors,
}: {
  data: TopPartner[];
  colors: string[];
}) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    setAnimated(false);
    const id = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(id);
  }, [data]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-28 text-muted-foreground text-sm">
        No data yet
      </div>
    );
  }

  const max = data[0].orderCount;

  return (
    <ol className="space-y-2.5">
      {data.map((partner, idx) => {
        const pct = max > 0 ? (partner.orderCount / max) * 100 : 0;
        const color = colors[idx % colors.length];

        const medal = RANK_BADGE[idx];

        return (
          <li key={partner.name} className="flex items-center gap-3">
            {/* Rank badge — gold/silver/bronze for top 3, bar color for the rest */}
            <span
              className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0"
              style={
                medal
                  ? {
                    backgroundColor: medal.bg,
                    color: medal.text,
                    boxShadow: `0 0 0 2px ${medal.ring}`,
                  }
                  : { backgroundColor: color, color: '#fff' }
              }
            >
              {idx < 3 ? idx + 1 : ''}
            </span>

            {/* Name + bar */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1 gap-2">
                <span
                  className="text-sm font-medium truncate"
                  title={partner.name}
                >
                  {partner.name}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                  {partner.orderCount} orders
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out-expo"
                  style={{ width: animated ? `${pct}%` : '0%', backgroundColor: color }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function TopClientsChart({ clients, transporters }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top Clients &amp; Carriers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Clients */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-blue-500" />
              <p className="text-sm font-medium">Top Clients</p>
            </div>
            <LeaderboardList data={clients} colors={CLIENT_COLORS} />
          </div>

          {/* Carriers */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Truck className="w-4 h-4 text-emerald-500" />
              <p className="text-sm font-medium">Top Carriers</p>
            </div>
            <LeaderboardList data={transporters} colors={CARRIER_COLORS} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
