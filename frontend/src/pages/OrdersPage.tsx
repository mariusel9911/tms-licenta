import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Archive, Eye, Package, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { TableSkeleton } from '@/components/common/TableSkeleton';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { OrdersTable } from '@/components/orders/OrdersTable';
import { CharteringAgreementForm } from '@/components/orders/CharteringAgreementForm';
import { OrderDetailPage } from '@/components/orders/OrderDetailPage';
import {
  TableSettingsModal,
  ALL_COLUMN_IDS,
  loadColumnPrefs,
  saveColumnPrefs,
  type ColumnId,
} from '@/components/orders/TableSettingsModal';
import { useOrdersList, useDeleteOrder, useDuplicateOrder, useSendOrder } from '@/hooks/useOrders';
import { exportOrdersCsv } from '@/api/orders.api';
import { useToast } from '@/hooks/use-toast';
import type { Order, OrderFilters as OrderFiltersType } from '@/types/order.types';

// ── Archive view (inner component) ──────────────────────────────────────────

interface ArchiveViewProps {
  dateFrom: string;
  dateTo: string;
  onViewDetail: (order: Order) => void;
  onDuplicate: (id: number) => void;
  onDelete: (order: Order) => void;
}

function ArchiveView({ dateFrom, dateTo, onViewDetail, onDuplicate, onDelete }: ArchiveViewProps) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useOrdersList(page, 20, {
    archived: true,
    dateFrom,
    dateTo,
  });

  if (isLoading) {
    return <TableSkeleton rows={8} columns={['w-20', 'w-24', 'w-28', 'flex-1', 'w-28', 'flex-1', 'w-16', 'w-24', 'w-24', 'w-24', 'w-16', 'w-24']} />;
  }

  return (
    <OrdersTable
      data={data ?? { items: [], total: 0, page: 1, limit: 20, totalPages: 0 }}
      page={page}
      limit={20}
      onPageChange={setPage}
      onLimitChange={() => undefined}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
      onViewDetail={onViewDetail}
      visibleColumns={ALL_COLUMN_IDS}
      columnOrder={ALL_COLUMN_IDS}
    />
  );
}

// ── Tab type ─────────────────────────────────────────────────────────────────

interface OrderTab {
  id: string;
  type: 'form' | 'detail';
  /** form tabs: order being edited (null = new order) */
  order?: Order | null;
  /** detail tabs: order ID to show */
  orderId?: number;
  /** display label */
  orderNumber?: string;
  /** where the form was opened from — controls where Close returns */
  formOrigin?: 'list' | 'detail';
  /** where the detail was opened from — controls where Back goes */
  detailOrigin?: 'list' | 'archive';
}

const MAX_TABS = 5;

// ── Main OrdersPage ──────────────────────────────────────────────────────────

export default function OrdersPage() {
  useEffect(() => { document.title = 'Orders'; }, []);
  const { toast } = useToast();

  // ── Tab state ───────────────────────────────────────────────────────────────
  const [orderTabs, setOrderTabs] = useState<OrderTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null); // null = list view

  const activeTab = orderTabs.find(t => t.id === activeTabId) ?? null;
  const isListView = activeTabId === null;

  // Archive date range — visible as a tab when set
  const [archiveDateRange, setArchiveDateRange] = useState<{ from: string; to: string } | null>(null);
  const isArchiveView = isListView && !!archiveDateRange;

  // ── Pagination/filter/sort state ────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [filters, setFilters] = useState<OrderFiltersType>({});
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // ── Delete/send dialog state ────────────────────────────────────────────────
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [orderToSend, setOrderToSend] = useState<Order | null>(null);

  // ── Table settings ──────────────────────────────────────────────────────────
  const [showTableSettings, setShowTableSettings] = useState(false);
  const [columnPrefs, setColumnPrefs] = useState(loadColumnPrefs);

  const { data, isLoading } = useOrdersList(page, limit, { ...filters, sortBy, sortOrder });
  const deleteOrder = useDeleteOrder();
  const duplicateOrder = useDuplicateOrder();
  const sendOrderMutation = useSendOrder();

  // ── Tab helpers ─────────────────────────────────────────────────────────────

  const openFormTab = (order: Order | null, origin: 'list' | 'detail' = 'list') => {
    if (order) {
      // De-dupe: editing same order → activate existing tab
      const existing = orderTabs.find(t => t.type === 'form' && t.order?.id === order.id);
      if (existing) { setActiveTabId(existing.id); return; }
    }
    if (orderTabs.length >= MAX_TABS) {
      toast({ title: 'Maximum tabs reached', description: 'Close a tab to open a new one.', duration: 4000 });
      return;
    }
    const id = crypto.randomUUID();
    setOrderTabs(prev => [...prev, { id, type: 'form', order, orderNumber: order?.orderNumber, formOrigin: origin }]);
    setActiveTabId(id);
  };

  const openDetailTab = (order: Order, origin: 'list' | 'archive' = 'list') => {
    // De-dupe: same order already open in a detail tab → activate it
    const existing = orderTabs.find(t => t.type === 'detail' && t.orderId === order.id);
    if (existing) { setActiveTabId(existing.id); return; }
    if (orderTabs.length >= MAX_TABS) {
      toast({ title: 'Maximum tabs reached', description: 'Close a tab to open a new one.', duration: 4000 });
      return;
    }
    const id = crypto.randomUUID();
    setOrderTabs(prev => [...prev, { id, type: 'detail', orderId: order.id, orderNumber: order.orderNumber, detailOrigin: origin }]);
    setActiveTabId(id);
  };

  const closeTab = (tabId: string) => {
    const tab = orderTabs.find(t => t.id === tabId);
    if (!tab) return;
    const remaining = orderTabs.filter(t => t.id !== tabId);
    setOrderTabs(remaining);

    if (activeTabId === tabId) {
      // If a form was opened from a detail tab, return to that detail tab
      if (tab.type === 'form' && tab.formOrigin === 'detail' && tab.order?.id) {
        const detailTab = remaining.find(t => t.type === 'detail' && t.orderId === tab.order!.id);
        if (detailTab) { setActiveTabId(detailTab.id); return; }
      }
      setActiveTabId(null);
      document.title = 'Orders';
    }
  };

  const closeArchive = () => {
    setArchiveDateRange(null);
  };

  // ── Filter / sort helpers ────────────────────────────────────────────────────

  const handleFiltersChange = (newFilters: OrderFiltersType) => {
    if (JSON.stringify(newFilters) !== JSON.stringify(filters)) {
      setFilters(newFilters);
      setPage(1);
    }
  };

  const handleLoadArchive = (from: string, to: string) => {
    setArchiveDateRange({ from, to });
    setActiveTabId(null); // ensure list view is active so archive tab is visible
  };

  const handleSortChange = (col: string, dir: 'asc' | 'desc') => {
    setSortBy(col);
    setSortOrder(dir);
    setPage(1);
  };

  // ── Column visibility & order ─────────────────────────────────────────────────

  const handleToggleColumn = (id: ColumnId) => {
    setColumnPrefs((prev) => {
      const visible = prev.visible.includes(id)
        ? prev.visible.filter((c) => c !== id)
        : [...prev.visible, id];
      const next = { ...prev, visible };
      saveColumnPrefs(next);
      return next;
    });
  };

  const handleReorderColumns = (newOrder: ColumnId[]) => {
    setColumnPrefs((prev) => {
      const next = { ...prev, order: newOrder };
      saveColumnPrefs(next);
      return next;
    });
  };

  const handleResetColumns = () => {
    const defaults = { visible: [...ALL_COLUMN_IDS], order: [...ALL_COLUMN_IDS] };
    setColumnPrefs(defaults);
    saveColumnPrefs(defaults);
  };

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleDuplicate = async (id: number) => {
    try {
      const newOrder = await duplicateOrder.mutateAsync(id);
      toast({
        title: 'Order duplicated',
        description: `New order ${newOrder.orderNumber} created as Draft.`,
      });
    } catch {
      toast({ title: 'Failed to duplicate order', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!orderToDelete) return;
    const wasDetailTab = activeTab?.type === 'detail' && activeTab.orderId === orderToDelete.id;
    const wasArchive = activeTab?.detailOrigin === 'archive';
    try {
      await deleteOrder.mutateAsync(orderToDelete.id);
      toast({ title: `Order ${orderToDelete.orderNumber} deleted` });
      if (wasDetailTab) {
        if (wasArchive) {
          // Return to list view (archive still visible there)
          setActiveTabId(null);
        } else {
          closeTab(activeTab!.id);
        }
      }
    } catch (err: unknown) {
      const backendMsg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      const isBusinessError = !!backendMsg?.includes('must be cancelled');
      toast({
        title: isBusinessError ? 'Cannot delete order' : 'Failed to delete order',
        description: isBusinessError ? backendMsg : undefined,
        variant: 'destructive',
      });
    } finally {
      setOrderToDelete(null);
    }
  };

  const handleSendOrder = async () => {
    if (!orderToSend) return;
    try {
      await sendOrderMutation.mutateAsync(orderToSend.id);
      toast({
        title: `Order ${orderToSend.orderNumber} sent`,
        description: orderToSend.transporter?.name
          ? `Sent to ${orderToSend.transporter.name}`
          : undefined,
      });
    } catch (err: unknown) {
      const backendMsg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast({
        title: 'Failed to send order',
        description: backendMsg ?? undefined,
        variant: 'destructive',
      });
    } finally {
      setOrderToSend(null);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await exportOrdersCsv(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    }
  };

  // Archive tab label — e.g. "01 Jan 2024 — 31 Mar 2024"
  const archiveTabLabel = archiveDateRange
    ? `${format(parseISO(archiveDateRange.from), 'dd MMM yyyy')} — ${format(parseISO(archiveDateRange.to), 'dd MMM yyyy')}`
    : '';

  // Keyboard shortcut: N → open New Order form (when in list view, not typing in an input)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey && isListView) {
        openFormTab(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isListView]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shared tab label/icon styles
  const tabActive = 'bg-white font-medium text-gray-900 border-b-2 border-b-blue-600 -mb-px';
  const tabInactive = 'bg-gray-50 text-gray-500 hover:bg-gray-100';

  return (
    <div className="space-y-0">

      {/* ─── Tab bar ─── */}
      <div className="flex border-b bg-white -mx-6 -mt-6 mb-4 px-2">

        {/* My Shipments tab */}
        <button
          onClick={() => setActiveTabId(null)}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm border-r transition-colors whitespace-nowrap',
            isListView ? tabActive : tabInactive,
          )}
        >
          <Package className="h-4 w-4" />
          My Shipments
        </button>

        {/* Dynamic form / detail tabs */}
        {orderTabs.map(tab => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={cn(
                'flex items-center gap-1 px-4 py-2.5 text-sm border-r transition-colors whitespace-nowrap',
                isActive ? tabActive : tabInactive,
              )}
            >
              <button
                onClick={() => setActiveTabId(tab.id)}
                className="flex items-center gap-1 outline-none"
              >
                {tab.type === 'form'
                  ? <Plus className="h-3 w-3" />
                  : <Eye className="h-3 w-3" />
                }
                <span>{tab.type === 'form'
                  ? (tab.order ? tab.orderNumber : 'New Order')
                  : tab.orderNumber
                }</span>
              </button>
              <button
                onClick={() => closeTab(tab.id)}
                className="ml-1 text-gray-400 hover:text-gray-700 rounded"
                title="Close tab"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}

        {/* Archive tab — visible when an archive date range is loaded */}
        {archiveDateRange && (
          <button
            onClick={() => setActiveTabId(null)}
            className={cn(
              'flex items-center gap-1 px-4 py-2.5 text-sm border-r transition-colors whitespace-nowrap',
              isArchiveView
                ? 'bg-white font-medium text-orange-600 border-b-2 border-b-orange-500 -mb-px'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100',
            )}
          >
            <Archive className="h-3.5 w-3.5" />
            <span>Archive {archiveTabLabel}</span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); closeArchive(); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); closeArchive(); } }}
              className="ml-2 text-gray-400 hover:text-gray-700 rounded"
              title="Close archive tab"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          </button>
        )}
      </div>

      {/* ─── List / Archive view (always rendered when no tab is active) ─── */}
      <div className={activeTabId !== null ? 'hidden' : ''}>
        {!archiveDateRange ? (
          <div className="space-y-4 animate-in fade-in-0 duration-200">
            <OrderFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onNewOrder={() => openFormTab(null)}
              onExport={handleExport}
              onOpenTableSettings={() => setShowTableSettings(true)}
              onLoadArchive={handleLoadArchive}
            />

            {isLoading ? (
              <TableSkeleton rows={8} columns={['w-20', 'w-24', 'w-28', 'flex-1', 'w-28', 'flex-1', 'w-16', 'w-24', 'w-24', 'w-24', 'w-16', 'w-24']} />
            ) : (
              <OrdersTable
                data={data ?? { items: [], total: 0, page: 1, limit, totalPages: 0 }}
                page={page}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
                onDuplicate={handleDuplicate}
                onDelete={(order) => setOrderToDelete(order)}
                onViewDetail={openDetailTab}
                onSendOrder={(order) => setOrderToSend(order)}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={handleSortChange}
                visibleColumns={columnPrefs.visible}
                columnOrder={columnPrefs.order}
              />
            )}

            {/* Send confirmation */}
            <ConfirmDialog
              open={orderToSend !== null}
              title="Trimiteți comanda?"
              description={
                orderToSend
                  ? `Trimiteți comanda ${orderToSend.orderNumber}${orderToSend.transporter?.name ? ` către ${orderToSend.transporter.name}` : ''}? Această acțiune este ireversibilă.`
                  : ''
              }
              confirmLabel="Trimite"
              pendingLabel="Se trimite…"
              isPending={sendOrderMutation.isPending}
              onConfirm={handleSendOrder}
              onCancel={() => setOrderToSend(null)}
            />

            {/* Table settings modal */}
            <TableSettingsModal
              open={showTableSettings}
              visibleColumns={columnPrefs.visible}
              columnOrder={columnPrefs.order}
              onToggle={handleToggleColumn}
              onReorder={handleReorderColumns}
              onReset={handleResetColumns}
              onClose={() => setShowTableSettings(false)}
            />
          </div>
        ) : (
          <div className="animate-in fade-in-0 duration-200">
            <ArchiveView
              dateFrom={archiveDateRange.from}
              dateTo={archiveDateRange.to}
              onViewDetail={(order) => openDetailTab(order, 'archive')}
              onDuplicate={handleDuplicate}
              onDelete={(order) => setOrderToDelete(order)}
            />
          </div>
        )}
      </div>

      {/* ─── Tab contents — all mounted, only active is shown ─── */}
      {orderTabs.map(tab => (
        <div key={tab.id} className={tab.id !== activeTabId ? 'hidden' : ''}>
          {tab.type === 'form' && (
            <div className="animate-in fade-in-0 duration-200">
              <CharteringAgreementForm
                order={tab.order ?? undefined}
                onClose={() => closeTab(tab.id)}
                onSaved={() => {
                  closeTab(tab.id);
                }}
              />
            </div>
          )}
          {tab.type === 'detail' && tab.orderId !== undefined && (
            <div className="animate-in fade-in-0 duration-200">
              <OrderDetailPage
                orderId={tab.orderId}
                onEdit={(order) => openFormTab(order, 'detail')}
                onDuplicate={handleDuplicate}
                onDelete={(order) => setOrderToDelete(order)}
                onBack={() => closeTab(tab.id)}
              />
            </div>
          )}
        </div>
      ))}

      {/* ─── Delete confirmation (shared across all views) ─── */}
      <ConfirmDialog
        open={orderToDelete !== null}
        title={orderToDelete?.archivedAt ? 'Delete Archived Order' : 'Delete Order'}
        description={
          orderToDelete
            ? orderToDelete.archivedAt
              ? `Delete archived order ${orderToDelete.orderNumber}? This action cannot be undone.`
              : `Delete order ${orderToDelete.orderNumber}? This action cannot be undone. Active orders (Confirmed / In Progress) must be cancelled first.`
            : ''
        }
        confirmLabel="Delete"
        isDestructive
        onConfirm={handleDelete}
        onCancel={() => setOrderToDelete(null)}
      />
    </div>
  );
}
