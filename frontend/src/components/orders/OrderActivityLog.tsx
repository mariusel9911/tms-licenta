import { format, isToday, isYesterday } from 'date-fns';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import type { ActivityLogEntry } from '@/api/activity.api';

interface OrderActivityLogProps {
  entries: ActivityLogEntry[];
  isLoading: boolean;
}

interface DateGroup {
  dateLabel: string;
  entries: ActivityLogEntry[];
}

function groupByDate(entries: ActivityLogEntry[]): DateGroup[] {
  const groups = new Map<string, ActivityLogEntry[]>();
  for (const entry of entries) {
    const dateKey = format(new Date(entry.createdAt), 'yyyy-MM-dd');
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey)!.push(entry);
  }
  return Array.from(groups.entries()).map(([dateKey, items]) => {
    const d = new Date(dateKey + 'T12:00:00'); // noon to avoid TZ-edge issues
    let dateLabel: string;
    if (isToday(d)) dateLabel = 'Today';
    else if (isYesterday(d)) dateLabel = 'Yesterday';
    else dateLabel = format(d, 'MMMM d, yyyy');
    return { dateLabel, entries: items };
  });
}

function getInitial(name: string | null | undefined): string {
  return (name ?? '?').charAt(0).toUpperCase();
}

export function OrderActivityLog({ entries, isLoading }: OrderActivityLogProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">No activity yet.</p>
    );
  }

  const groups = groupByDate(entries);

  return (
    <div className="max-h-[400px] overflow-y-auto pr-1 space-y-5">
      {groups.map((group) => (
        <div key={group.dateLabel}>
          {/* Date header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted-foreground px-2">
              {group.dateLabel}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Entries for this day */}
          <div className="space-y-3">
            {group.entries.map((entry) => (
              <div key={entry.id} className="flex gap-3 items-start">
                {/* Green circle avatar */}
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-semibold">
                  {getInitial(entry.user?.name)}
                </div>

                {/* Activity card */}
                <div className="flex-1 bg-white rounded-lg border border-border px-3 py-2 shadow-sm">
                  <p className="text-sm leading-snug">
                    <span className="font-semibold">{entry.user?.name ?? 'System'}</span>{' '}
                    {entry.action}
                  </p>
                  {entry.details && (() => {
                    try {
                      const d = JSON.parse(entry.details) as {
                        field?: string;
                        oldValue?: string;
                        newValue?: string;
                      };
                      if (!d.oldValue && !d.newValue) return null;
                      if (d.field === 'internal notes') return null;
                      return (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <span className="line-through opacity-60">{d.oldValue || '—'}</span>
                          {' → '}
                          <span className="font-medium text-gray-700">{d.newValue || '—'}</span>
                        </p>
                      );
                    } catch {
                      return null;
                    }
                  })()}
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(entry.createdAt), 'HH:mm')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
