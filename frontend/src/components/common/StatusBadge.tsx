import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

const STATUS_STYLES: Record<OrderStatus, string> = {
  DRAFT: 'bg-gray-500 text-white hover:bg-gray-500',
  CONFIRMED: 'bg-blue-600 text-white hover:bg-blue-600',
  IN_PROGRESS: 'bg-amber-500 text-white hover:bg-amber-500',
  COMPLETED: 'bg-green-600 text-white hover:bg-green-600',
  CANCELLED: 'bg-red-600 text-white hover:bg-red-600',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: 'Draft',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Delivered',
  CANCELLED: 'Cancelled',
};

interface StatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn('border-0 font-medium', STATUS_STYLES[status], className)}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
