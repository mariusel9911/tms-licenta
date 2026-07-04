import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { usePatchOrderStatus } from '@/hooks/useOrders';
import { useToast } from '@/hooks/use-toast';
import type { OrderStatus } from '@/types/order.types';

const STATUS_STYLES: Record<OrderStatus, string> = {
  DRAFT:       'bg-gray-500 text-white',
  CONFIRMED:   'bg-blue-600 text-white',
  IN_PROGRESS: 'bg-amber-500 text-white',
  COMPLETED:   'bg-green-600 text-white',
  CANCELLED:   'bg-red-600 text-white',
};

const STATUS_HOVER: Record<OrderStatus, string> = {
  DRAFT:       'hover:bg-gray-600',
  CONFIRMED:   'hover:bg-blue-700',
  IN_PROGRESS: 'hover:bg-amber-600',
  COMPLETED:   'hover:bg-green-700',
  CANCELLED:   'hover:bg-red-700',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT:       'Draft',
  CONFIRMED:   'Confirmed',
  IN_PROGRESS: 'In Progress',
  COMPLETED:   'Delivered',
  CANCELLED:   'Cancelled',
};

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT:       ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  CONFIRMED:   ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DRAFT'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED:   [],
  CANCELLED:   [],
};

interface TableStatusPillProps {
  orderId: number;
  currentStatus: OrderStatus;
}

export function TableStatusPill({ orderId, currentStatus }: TableStatusPillProps) {
  const [open, setOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const patchStatus = usePatchOrderStatus();
  const { toast } = useToast();

  const handleSelect = (status: OrderStatus) => {
    if (status === currentStatus) {
      setOpen(false);
      return;
    }
    setOpen(false);
    setPendingStatus(status);
  };

  const allowedStatuses = VALID_TRANSITIONS[currentStatus];

  const handleConfirm = async () => {
    if (!pendingStatus) return;
    try {
      await patchStatus.mutateAsync({ id: orderId, status: pendingStatus });
      toast({ title: `Status changed to ${STATUS_LABELS[pendingStatus]}` });
    } catch (error) {
      const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to change status';
      toast({ title: msg, variant: 'destructive', duration: 5000 });
    } finally {
      setPendingStatus(null);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium cursor-pointer transition-[transform,colors] whitespace-nowrap ${STATUS_STYLES[currentStatus]} ${STATUS_HOVER[currentStatus]}`}
            disabled={patchStatus.isPending}
          >
            {STATUS_LABELS[currentStatus]}
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-44 p-1.5"
          align="start"
          side="bottom"
          style={{ transformOrigin: 'var(--radix-popover-content-transform-origin)' }}
        >
          <div className="flex flex-col gap-1">
            {allowedStatuses.length === 0 ? (
              <span className="px-3 py-1 text-xs text-muted-foreground">No transitions available</span>
            ) : (
              allowedStatuses.map((status) => (
                <button
                  key={status}
                  onClick={() => handleSelect(status)}
                  className={`flex items-center rounded-lg px-3 py-2 text-xs font-medium transition-colors text-left ${STATUS_STYLES[status]} ${STATUS_HOVER[status]}`}
                >
                  {STATUS_LABELS[status]}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      <ConfirmDialog
        open={pendingStatus !== null}
        title="Change Order Status"
        description={
          pendingStatus
            ? `Change status from "${STATUS_LABELS[currentStatus]}" to "${STATUS_LABELS[pendingStatus]}"?`
            : ''
        }
        confirmLabel="Change Status"
        onConfirm={handleConfirm}
        onCancel={() => setPendingStatus(null)}
      />
    </>
  );
}
