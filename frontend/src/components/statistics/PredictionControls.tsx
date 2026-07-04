import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PredictionTimeframe } from '@/types/statistics.types';

const TIMEFRAMES: { value: PredictionTimeframe; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];

interface Props {
  timeframe: PredictionTimeframe;
  onTimeframeChange: (t: PredictionTimeframe) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function PredictionControls({
  timeframe,
  onTimeframeChange,
  onRefresh,
  isRefreshing,
}: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-medium text-muted-foreground">Forecast period:</span>
      <div role="group" aria-label="Forecast period" className="flex rounded-md border overflow-hidden">
        {TIMEFRAMES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onTimeframeChange(value)}
            className={cn(
              'cursor-pointer px-3 py-1.5 text-sm font-medium transition-[transform,colors]',
              timeframe === value
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="ml-auto transition-[transform,colors]"
      >
        <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', isRefreshing && 'animate-spin')} />
        Refresh
      </Button>
    </div>
  );
}
