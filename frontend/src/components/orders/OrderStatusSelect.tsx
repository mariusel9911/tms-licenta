import { useState } from 'react';
import {
  FilePen,
  CheckCircle2,
  Truck,
  PackageCheck,
  XCircle,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { usePatchOrderStatus } from '@/hooks/useOrders';
import { useToast } from '@/hooks/use-toast';
import type { OrderStatus } from '@/types/order.types';

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT:       ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  CONFIRMED:   ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DRAFT'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED:   [],
  CANCELLED:   [],
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT:       'Draft',
  CONFIRMED:   'Confirmed',
  IN_PROGRESS: 'In Progress',
  COMPLETED:   'Delivered',
  CANCELLED:   'Cancelled',
};

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

const STATUS_ICONS: Record<OrderStatus, LucideIcon> = {
  DRAFT:       FilePen,
  CONFIRMED:   CheckCircle2,
  IN_PROGRESS: Truck,
  COMPLETED:   PackageCheck,
  CANCELLED:   XCircle,
};

interface OrderStatusSelectProps {
  orderId: number;
  currentStatus: OrderStatus;
  triggerClassName?: string;
}

export function OrderStatusSelect({ orderId, currentStatus }: OrderStatusSelectProps) {
  const [open, setOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const patchStatus = usePatchOrderStatus();
  const { toast } = useToast();

  const allowedStatuses = VALID_TRANSITIONS[currentStatus];
  const isTerminal = allowedStatuses.length === 0;
  const Icon = STATUS_ICONS[currentStatus];

  const handleSelect = (status: OrderStatus) => {
    setOpen(false);
    setPendingStatus(status);
  };

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

  const triggerClasses = `inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium
    transition-[background-color,transform,colors] duration-150
    ${STATUS_STYLES[currentStatus]}
    ${!isTerminal && !patchStatus.isPending ? STATUS_HOVER[currentStatus] + ' cursor-pointer' : 'opacity-80 cursor-default'}`;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={triggerClasses}
            disabled={isTerminal || patchStatus.isPending}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span>{STATUS_LABELS[currentStatus]}</span>
            {!isTerminal && (
              <ChevronDown
                className={`h-3.5 w-3.5 ml-0.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              />
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-48 p-1.5"
          align="start"
          side="bottom"
          style={{ transformOrigin: 'var(--radix-popover-content-transform-origin)' }}
        >
          <div className="flex flex-col gap-1">
            {allowedStatuses.map((s) => {
              const ItemIcon = STATUS_ICONS[s];
              return (
                <button
                  key={s}
                  onClick={() => handleSelect(s)}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-left
                    transition-[background-color,transform] duration-100
                    ${STATUS_STYLES[s]} ${STATUS_HOVER[s]}`}
                >
                  <ItemIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>{STATUS_LABELS[s]}</span>
                </button>
              );
            })}
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
