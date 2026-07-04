import { Eye, Copy, Trash2, Send, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/store/auth.store';
import type { Order, PaginatedOrders } from '@/types/order.types';
import type { ColumnId } from '@/components/orders/TableSettingsModal';
import { ORDER_COLUMNS, type RenderCtx } from '@/components/orders/orderColumns';

// ─── Sortable Th ──────────────────────────────────────────────────────────────
// Note: "Sortable" here means sort-by-column, NOT @dnd-kit drag-and-drop.
// The drag-and-drop reorder lives in TableSettingsModal.tsx.

interface SortableThProps {
  children: React.ReactNode;
  columnKey?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (col: string, dir: 'asc' | 'desc') => void;
}

function SortableTh({ children, columnKey, sortBy, sortOrder, onSortChange }: SortableThProps) {
  const isActive = columnKey && sortBy === columnKey;

  const handleClick = () => {
    if (!columnKey || !onSortChange) return;
    if (isActive) {
      onSortChange(columnKey, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(columnKey, 'asc');
    }
  };

  const SortIcon = isActive
    ? sortOrder === 'asc'
      ? ChevronUp
      : ChevronDown
    : ChevronsUpDown;

  return (
    <th
      className={`px-1.5 py-2 text-left text-[0.65rem] font-semibold text-[#6b7280] uppercase tracking-wide whitespace-nowrap align-top leading-tight ${columnKey ? 'cursor-pointer select-none hover:text-gray-900' : ''}`}
      onClick={columnKey ? handleClick : undefined}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {columnKey && (
          <SortIcon
            className={`h-3 w-3 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
          />
        )}
      </span>
    </th>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface OrdersTableProps {
  data: PaginatedOrders;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onDuplicate: (id: number) => void;
  onDelete: (order: Order) => void;
  onViewDetail?: (order: Order) => void;
  onSendOrder?: (order: Order) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (col: string, dir: 'asc' | 'desc') => void;
  visibleColumns: ColumnId[];
  columnOrder: ColumnId[];
}

export function OrdersTable({
  data,
  page,
  limit,
  onPageChange,
  onLimitChange,
  onDuplicate,
  onDelete,
  onViewDetail,
  onSendOrder,
  sortBy,
  sortOrder,
  onSortChange,
  visibleColumns,
  columnOrder,
}: OrdersTableProps) {
  const user = useAuthStore((s) => s.user);
  const { items, total, totalPages } = data;

  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  // Ordered list of visible column IDs — drives colgroup, thead, and tbody
  const orderedVisible = columnOrder.filter((id) => visibleColumns.includes(id));

  // +1 for always-visible actions column
  const visibleColCount = orderedVisible.length + 1;

  const sortProps = { sortBy, sortOrder, onSortChange };

  const ctx: RenderCtx = { onViewDetail };

  return (
    <div className="space-y-2 pb-20">
      {/* Scrollable table — card styling matches VehiclesTable / PartnersTable */}
      <div
        className="overflow-x-auto rounded-xl bg-white"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08)' }}
      >
        <table className="w-full text-sm border-collapse table-fixed">
          <colgroup>
            {orderedVisible.map((id) => (
              <col key={id} style={{ width: ORDER_COLUMNS[id].width }} />
            ))}
            <col style={{ width: '6.5%' }} />{/* actions — always last */}
          </colgroup>
          <thead>
            <tr className="border-b border-[#e5e7eb] bg-[#fafafa]">
              {orderedVisible.map((id) => {
                const col = ORDER_COLUMNS[id];
                return (
                  <SortableTh key={id} columnKey={col.sortKey} {...sortProps}>
                    {col.headerLabel}
                  </SortableTh>
                );
              })}
              {/* Actions always visible */}
              <SortableTh>Actions</SortableTh>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColCount}
                  className="py-12 text-center text-muted-foreground text-sm"
                >
                  No orders found.
                </td>
              </tr>
            ) : (
              items.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-[#f3f4f6] last:border-0 hover:bg-[#f9fafb] transition-colors duration-100"
                >
                  {orderedVisible.map((id) => (
                    <Td key={id}>{ORDER_COLUMNS[id].render(order, ctx)}</Td>
                  ))}
                  {/* Actions — always visible, always last */}
                  <Td>
                    <div className="flex items-center gap-1">
                      {onViewDetail && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-blue-500 hover:text-blue-700 hover:bg-blue-50 transition-[transform,colors]"
                          title="View details"
                          onClick={() => onViewDetail(order)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {onSendOrder && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-7 w-7 transition-[transform,colors] ${order.isSent ? 'text-green-500 opacity-60' : 'text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50'}`}
                          title={order.isSent ? 'Already sent' : 'Send order'}
                          disabled={order.isSent}
                          onClick={() => !order.isSent && onSendOrder(order)}
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 transition-[transform,colors]"
                        title="Duplicate"
                        onClick={() => onDuplicate(order.id)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      {user?.role === 'ADMIN' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 transition-[transform,colors]"
                          title="Delete"
                          onClick={() => onDelete(order)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination — matches CargoTrack bottom-right layout */}
      <div className="flex items-center justify-end gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Items per page:</span>
          <Select
            value={String(limit)}
            onValueChange={(val) => {
              onLimitChange(Number(val));
              onPageChange(1);
            }}
          >
            <SelectTrigger className="h-8 w-20 bg-background text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span>
          {total === 0 ? '0' : `${startItem} – ${endItem}`} of {total}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
            title="First page"
          >
            «
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            title="Previous page"
          >
            ‹
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            title="Next page"
          >
            ›
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages}
            title="Last page"
          >
            »
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Local helper sub-component ───────────────────────────────────────────────

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-1.5 py-2 align-middle overflow-hidden">
      {children}
    </td>
  );
}
