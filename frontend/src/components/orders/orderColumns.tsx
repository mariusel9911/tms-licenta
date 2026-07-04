import { type ReactNode } from 'react';
import { format } from 'date-fns';
import { countries } from 'country-data-list';
import { CircleFlag } from 'react-circle-flags';
import { TableStatusPill } from '@/components/orders/TableStatusPill';
import type { Order } from '@/types/order.types';
import type { ColumnId } from '@/components/orders/TableSettingsModal';

export interface RenderCtx {
  onViewDetail?: (order: Order) => void;
}

export interface OrderColumnDef {
  id: ColumnId;
  width: string;
  sortKey?: string;
  headerLabel: ReactNode;
  render: (order: Order, ctx: RenderCtx) => ReactNode;
}

// ─── Internal helpers (single source of truth, previously in OrdersTable.tsx) ─

const countryList = countries.all.filter((c) => c.alpha2 && c.status === 'assigned');

function getAlpha2(countryName: string | null): string | null {
  if (!countryName) return null;
  const found = countryList.find(
    (c) => c.name.toLowerCase() === countryName.toLowerCase(),
  );
  return found?.alpha2?.toLowerCase() ?? null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'dd-MM-yyyy HH:mm');
  } catch {
    return '—';
  }
}

function formatPrice(price: string | null, currency: string | null): string {
  if (!price) return '—';
  const num = parseFloat(price);
  return `${isNaN(num) ? price : num.toFixed(2)} ${currency ?? 'EUR'}`;
}

function DatePill({ dateStr }: { dateStr: string | null }): ReactNode {
  if (!dateStr) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className="inline-flex items-center rounded bg-cyan-600 px-1 py-px text-[10px] font-medium text-white whitespace-nowrap">
      {formatDate(dateStr)}
    </span>
  );
}

function CountryAddressCell({
  country,
  address,
}: {
  country: string | null;
  address: string | null;
}): ReactNode {
  const alpha2 = getAlpha2(country);
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      {alpha2 ? (
        <CircleFlag countryCode={alpha2} height={16} width={16} className="shrink-0" />
      ) : (
        <span className="text-xs text-muted-foreground shrink-0">🌐</span>
      )}
      <span className="truncate text-[11px] block" title={address ?? ''}>
        {address ?? '—'}
      </span>
    </div>
  );
}

// ─── Column definitions ───────────────────────────────────────────────────────
// actions column is NOT included here — it is always rendered last in OrdersTable
// and is excluded from TABLE_COLUMNS in TableSettingsModal.

export const ORDER_COLUMNS: Record<ColumnId, OrderColumnDef> = {
  documentDate: {
    id: 'documentDate',
    width: '6%',
    sortKey: 'documentDate',
    headerLabel: <>Document<br />date</>,
    render: (order) => (
      <span className="whitespace-nowrap text-xs">
        {format(new Date(order.documentDate), 'dd/MM/yyyy')}
      </span>
    ),
  },
  partner: {
    id: 'partner',
    width: '7.5%',
    sortKey: 'client.name',
    headerLabel: 'Partner',
    render: (order) => (
      <span
        className="block truncate text-[11px] font-medium"
        title={order.client?.name ?? ''}
      >
        {order.client?.name ?? '—'}
      </span>
    ),
  },
  clientRef: {
    id: 'clientRef',
    width: '6%',
    sortKey: 'clientOrderReference',
    headerLabel: <>Reference<br />number</>,
    render: (order) => (
      <span className="text-xs">{order.clientOrderReference ?? '—'}</span>
    ),
  },
  orderSeries: {
    id: 'orderSeries',
    width: '3%',
    sortKey: undefined,
    headerLabel: <>Order<br />series</>,
    render: (order) => (
      <span className="text-xs font-mono">{order.orderSeries}</span>
    ),
  },
  orderNumber: {
    id: 'orderNumber',
    width: '3.5%',
    sortKey: 'orderNumber',
    headerLabel: <>Order<br />number</>,
    render: (order, ctx) =>
      ctx.onViewDetail ? (
        <button
          className="text-xs font-mono font-semibold text-blue-600 hover:underline focus:outline-none"
          onClick={() => ctx.onViewDetail!(order)}
          title="View order details"
        >
          {order.orderNumber.replace(order.orderSeries, '')}
        </button>
      ) : (
        <span className="text-xs font-mono font-semibold">
          {order.orderNumber.replace(order.orderSeries, '')}
        </span>
      ),
  },
  intermediary: {
    id: 'intermediary',
    width: '7%',
    sortKey: 'transporter.name',
    headerLabel: <>Intermediary<br />partner</>,
    render: (order) => (
      <span
        className="block truncate text-[11px]"
        title={order.transporter?.name ?? ''}
      >
        {order.transporter?.name ?? '—'}
      </span>
    ),
  },
  vehicle: {
    id: 'vehicle',
    width: '4%',
    sortKey: undefined,
    headerLabel: 'Vehicle',
    render: (order) => (
      <span className="text-xs font-mono">
        {order.vehicle?.licensePlate ?? '—'}
      </span>
    ),
  },
  driver: {
    id: 'driver',
    width: '5%',
    sortKey: 'driverName',
    headerLabel: 'Driver',
    render: (order) => (
      <span className="block truncate text-[11px]">
        {order.driverName ?? '—'}
      </span>
    ),
  },
  pickup: {
    id: 'pickup',
    width: '7.5%',
    sortKey: undefined,
    headerLabel: 'Pickup',
    render: (order) => (
      <CountryAddressCell
        country={order.pickupCountry}
        address={order.pickupAddress}
      />
    ),
  },
  pickupDate: {
    id: 'pickupDate',
    width: '7%',
    sortKey: 'pickupDateBegin',
    headerLabel: <>Pickup date<br />begin</>,
    render: (order) => <DatePill dateStr={order.pickupDateBegin} />,
  },
  delivery: {
    id: 'delivery',
    width: '7.5%',
    sortKey: undefined,
    headerLabel: 'Delivery',
    render: (order) => (
      <CountryAddressCell
        country={order.deliveryCountry}
        address={order.deliveryAddress}
      />
    ),
  },
  deliveryDate: {
    id: 'deliveryDate',
    width: '7%',
    sortKey: 'deliveryDateBegin',
    headerLabel: <>Delivery date<br />begin</>,
    render: (order) => <DatePill dateStr={order.deliveryDateBegin} />,
  },
  distance: {
    id: 'distance',
    width: '4.5%',
    sortKey: 'distanceKm',
    headerLabel: 'Distance',
    render: (order) => (
      <span className="text-xs whitespace-nowrap">
        {order.distanceKm ? `${parseFloat(order.distanceKm)} km` : '—'}
      </span>
    ),
  },
  clientPrice: {
    id: 'clientPrice',
    width: '5.5%',
    sortKey: 'clientPrice',
    headerLabel: <>Client<br />price</>,
    render: (order) => (
      <span className="text-xs whitespace-nowrap">
        {formatPrice(order.clientPrice, order.clientCurrency)}
      </span>
    ),
  },
  transporterPrice: {
    id: 'transporterPrice',
    width: '5.5%',
    sortKey: 'transporterPrice',
    headerLabel: <>Transporter<br />price</>,
    render: (order) => (
      <span className="text-xs whitespace-nowrap">
        {formatPrice(order.transporterPrice, order.transporterCurrency)}
      </span>
    ),
  },
  sent: {
    id: 'sent',
    width: '2.5%',
    sortKey: 'isSent',
    headerLabel: 'Sent',
    render: (order) =>
      order.isSent ? (
        <span className="text-green-600 font-semibold text-sm">✓</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  status: {
    id: 'status',
    width: '7%',
    sortKey: 'status',
    headerLabel: 'Status',
    render: (order) => (
      <TableStatusPill orderId={order.id} currentStatus={order.status} />
    ),
  },
};
