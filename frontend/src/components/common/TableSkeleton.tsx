import { Skeleton } from '@/components/ui/skeleton';

const DEFAULT_COLUMNS = ['flex-1', 'w-32', 'w-24'];

interface TableSkeletonProps {
  rows?: number;
  columns?: string[];
}

export function TableSkeleton({ rows = 8, columns = DEFAULT_COLUMNS }: TableSkeletonProps) {
  return (
    <div
      className="rounded-xl bg-white overflow-hidden divide-y divide-gray-100"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08)' }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          {columns.map((width, j) => (
            <Skeleton key={j} className={`h-4 ${width} rounded`} />
          ))}
        </div>
      ))}
    </div>
  );
}
