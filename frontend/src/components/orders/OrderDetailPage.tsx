import { useEffect, useRef, useState } from 'react';
import { Archive, ArrowLeft, Copy, Download, FileText, Loader2, Pencil, Save, Send, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { countries } from 'country-data-list';
import { CircleFlag } from 'react-circle-flags';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/common/StatusBadge';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { OrderStatusSelect } from './OrderStatusSelect';
import { OrderActivityLog } from './OrderActivityLog';
import { useOrder, useOrdersList, usePreviewOrderPdf, useSendOrder, useDownloadOrderPdf, useUpdateOrder } from '@/hooks/useOrders';
import { useOrderActivity } from '@/hooks/useActivity';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth.store';
import type { AddressStop, CargoItem, CreateOrderDto, Order } from '@/types/order.types';

interface OrderDetailPageProps {
  orderId: number;
  onEdit: (order: Order) => void;
  onDuplicate: (id: number) => void;
  onDelete?: (order: Order) => void;
  onBack: () => void;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-900 break-words">{value ?? <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
}

function fmt(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try { return format(new Date(dateStr), 'dd/MM/yyyy HH:mm'); } catch { return '—'; }
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try { return format(new Date(dateStr), 'dd/MM/yyyy'); } catch { return '—'; }
}

function parseDetailAddressStops(json: string | null): AddressStop[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as AddressStop[];
    if (Array.isArray(parsed)) return parsed;
  } catch { /* ignore */ }
  return [];
}

function parseDetailCargoItems(order: Order): CargoItem[] {
  if (order.cargoItemsJson) {
    try {
      const parsed = JSON.parse(order.cargoItemsJson) as CargoItem[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* fall through */ }
  }
  if (order.cargoQuantity || order.cargoDescription || order.cargoWeightKg) {
    return [{
      qty: order.cargoQuantity ?? undefined,
      description: order.cargoDescription ?? undefined,
      lengthCm: order.cargoLengthCm ? Number(order.cargoLengthCm) : undefined,
      widthCm: order.cargoWidthCm ? Number(order.cargoWidthCm) : undefined,
      heightCm: order.cargoHeightCm ? Number(order.cargoHeightCm) : undefined,
      weightKg: order.cargoWeightKg ? Number(order.cargoWeightKg) : undefined,
    }];
  }
  return [];
}

export function OrderDetailPage({ orderId, onEdit, onDuplicate, onDelete, onBack }: OrderDetailPageProps) {
  const { data: order, isLoading } = useOrder(orderId);
  const user = useAuthStore((s) => s.user);
  useEffect(() => {
    document.title = order ? `${order.orderNumber}` : 'Orders';
  }, [order?.orderNumber]);
  const { data: activity = [], isLoading: activityLoading } = useOrderActivity(orderId);
  const previewPdf = usePreviewOrderPdf();
  const sendOrderMutation = useSendOrder();
  const downloadPdfMutation = useDownloadOrderPdf();
  const updateOrder = useUpdateOrder();
  const { toast } = useToast();

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingNotes && notesTextareaRef.current) {
      notesTextareaRef.current.focus();
    }
  }, [editingNotes]);

  const handleStartEditNotes = () => {
    setNotesValue(order?.internalNotes ?? '');
    setEditingNotes(true);
  };

  const handleSaveNotes = async () => {
    if (!order) return;
    try {
      await updateOrder.mutateAsync({ id: order.id, dto: { internalNotes: notesValue.trim() || undefined } });
      setEditingNotes(false);
      toast({ title: 'Internal notes saved' });
    } catch {
      toast({ title: 'Failed to save notes', variant: 'destructive' });
    }
  };

  const handleCancelNotes = () => {
    setEditingNotes(false);
  };

  const shouldFetchLinked = !!order?.vehicleId && order.vehicle?.status === 'ON_ROUTE' && order.status !== 'IN_PROGRESS';
  const { data: linkedVehicleData } = useOrdersList(
    1, 10,
    shouldFetchLinked ? { vehicleId: order!.vehicleId!, status: 'IN_PROGRESS' } : {},
    { enabled: shouldFetchLinked },
  );
  const linkedOrders = shouldFetchLinked
    ? (linkedVehicleData?.items ?? []).filter((o) => o.id !== orderId)
    : [];
  const [confirmSend, setConfirmSend] = useState(false);

  const handleViewPdf = async () => {
    if (!order) return;
    try {
      const dto: CreateOrderDto = { clientId: order.clientId, orderNumber: order.orderNumber };
      if (order.transporterId) dto.transporterId = order.transporterId;
      if (order.vehicleId) dto.vehicleId = order.vehicleId;
      if (order.driverName) dto.driverName = order.driverName;
      if (order.contactName) dto.contactName = order.contactName;
      if (order.clientOrderReference) dto.clientOrderReference = order.clientOrderReference;
      if (order.pickupAddress) dto.pickupAddress = order.pickupAddress;
      if (order.pickupCountry) dto.pickupCountry = order.pickupCountry;
      if (order.pickupDateBegin) dto.pickupDateBegin = order.pickupDateBegin;
      if (order.deliveryAddress) dto.deliveryAddress = order.deliveryAddress;
      if (order.deliveryCountry) dto.deliveryCountry = order.deliveryCountry;
      if (order.deliveryDateBegin) dto.deliveryDateBegin = order.deliveryDateBegin;
      if (order.distanceKm) dto.distanceKm = Number(order.distanceKm);
      if (order.notes) dto.notes = order.notes;
      dto.applyStamp = order.applyStamp ?? false;
      if (order.transporterPrice) dto.transporterPrice = Number(order.transporterPrice);
      dto.transporterCurrency = order.transporterCurrency ?? 'EUR';
      if (order.clientPrice) dto.clientPrice = Number(order.clientPrice);
      dto.clientCurrency = order.clientCurrency ?? 'EUR';
      const cargoItems = parseDetailCargoItems(order);
      if (cargoItems.length) dto.cargoItems = cargoItems;
      const additionalPickups = parseDetailAddressStops(order.additionalPickupsJson);
      if (additionalPickups.length) dto.additionalPickups = additionalPickups;
      const additionalDeliveries = parseDetailAddressStops(order.additionalDeliveriesJson);
      if (additionalDeliveries.length) dto.additionalDeliveries = additionalDeliveries;
      await previewPdf.mutateAsync(dto);
    } catch {
      toast({ title: 'Failed to generate PDF', variant: 'destructive' });
    }
  };

  const handleDownloadPdf = async () => {
    if (!order) return;
    try {
      const blob = await downloadPdfMutation.mutateAsync(order.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${order.orderNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Eroare la descărcarea PDF-ului', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20 text-muted-foreground text-sm">
        Order not found.
      </div>
    );
  }

  const isArchived = order.archivedAt !== null;

  return (
    <div className="space-y-4">
      {/* ── Header bar ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to list
          </Button>
          <span className="text-xl font-bold tracking-tight">{order.orderNumber}</span>
          <StatusBadge status={order.status} />
          {isArchived && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 px-2.5 py-0.5 text-xs font-medium">
              <Archive className="h-3 w-3" />
              Archived
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isArchived && (
            <OrderStatusSelect orderId={order.id} currentStatus={order.status} />
          )}
          <Button variant="outline" size="sm" onClick={handleViewPdf} disabled={previewPdf.isPending} className="gap-1.5">
            {previewPdf.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            View PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => onDuplicate(order.id)} className="gap-1.5">
            <Copy className="h-4 w-4" />
            Duplicate
          </Button>
          {!isArchived && (
            <Button size="sm" onClick={() => onEdit(order)} className="gap-1.5">
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          )}
          {isArchived && user?.role === 'ADMIN' && onDelete && (
            <Button variant="destructive" size="sm" onClick={() => onDelete(order)} className="gap-1.5">
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* ── Archived banner ── */}
      {isArchived && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm text-orange-800">
          <Archive className="h-4 w-4 shrink-0" />
          <span>
            This order is archived and cannot be edited. You can still view, resend, or download the PDF.
            {order.archivedAt && (
              <span className="ml-1 text-orange-600">Archived on {fmtDate(order.archivedAt)}.</span>
            )}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Left / center: order fields ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Overview card */}
          <div className="bg-white rounded-xl border border-border p-5 space-y-4"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Overview</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Order number" value={<span className="font-mono font-bold">{order.orderNumber}</span>} />
              <Field label="Document date" value={fmtDate(order.documentDate)} />
              <Field label="Client ref." value={order.clientOrderReference} />
              <Field label="Client" value={order.client?.name} />
              <Field label="Transporter" value={order.transporter?.name} />
              <Field label="Transporter ref." value={order.transporterReference} />
              <Field label="Vehicle" value={
                order.vehicle ? (
                  <span className="inline-flex items-center gap-1.5">
                    {order.vehicle.licensePlate}
                    {order.vehicle.status === 'ON_ROUTE' && (
                      <span className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700">On route</span>
                    )}
                    {order.vehicle.status === 'MAINTENANCE' && (
                      <span className="inline-flex items-center rounded px-1 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700">Maintenance</span>
                    )}
                  </span>
                ) : null
              } />
              <Field label="Driver" value={order.driverName} />
            </div>
          </div>

          {/* Vehicle on route warning — secondary order (vehicle already has an active shipment) */}
          {order.vehicle?.status === 'ON_ROUTE' && order.status !== 'IN_PROGRESS' && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <span>
                Vehicle {order.vehicle.licensePlate} is currently on route — this order is linked to an active shipment.
                {linkedOrders.length > 0 && (
                  <> Active shipment{linkedOrders.length > 1 ? 's' : ''}: <span className="font-semibold">{linkedOrders.map((o) => o.orderNumber).join(', ')}</span></>
                )}
              </span>
            </div>
          )}

          {/* Vehicle unavailable warning — blocks dispatch */}
          {order.status === 'CONFIRMED' && order.vehicle &&
            (order.vehicle.status === 'MAINTENANCE' || order.vehicle.status === 'INACTIVE') && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              Vehicle not available for dispatch — currently {order.vehicle.status === 'MAINTENANCE' ? 'in maintenance' : 'inactive'}
            </div>
          )}

          {/* Route card */}
          {(() => {
            const additionalPickups = parseDetailAddressStops(order.additionalPickupsJson);
            const additionalDeliveries = parseDetailAddressStops(order.additionalDeliveriesJson);
            const extraRowCount = Math.max(additionalPickups.length, additionalDeliveries.length);
            return (
              <div className="bg-white rounded-xl border border-border p-5 space-y-4"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Route</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Loading</p>
                    <Field label="Address" value={order.pickupAddress} />
                    <Field label="Country" value={order.pickupCountry ? (() => {
                      const c = countries.all.find(x => x.name.toLowerCase() === order.pickupCountry!.toLowerCase() && x.status === 'assigned');
                      return (
                        <span className="flex items-center gap-1.5">
                          {c && <CircleFlag countryCode={c.alpha2.toLowerCase()} height={16} width={16} />}
                          {order.pickupCountry}
                        </span>
                      );
                    })() : undefined} />
                    <Field label="Date begin" value={fmt(order.pickupDateBegin)} />
                    {order.pickupDateEnd && <Field label="Date end" value={fmt(order.pickupDateEnd)} />}
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Delivery</p>
                    <Field label="Address" value={order.deliveryAddress} />
                    <Field label="Country" value={order.deliveryCountry ? (() => {
                      const c = countries.all.find(x => x.name.toLowerCase() === order.deliveryCountry!.toLowerCase() && x.status === 'assigned');
                      return (
                        <span className="flex items-center gap-1.5">
                          {c && <CircleFlag countryCode={c.alpha2.toLowerCase()} height={16} width={16} />}
                          {order.deliveryCountry}
                        </span>
                      );
                    })() : undefined} />
                    <Field label="Date begin" value={fmt(order.deliveryDateBegin)} />
                    {order.deliveryDateEnd && <Field label="Date end" value={fmt(order.deliveryDateEnd)} />}
                  </div>
                </div>
                {extraRowCount > 0 && (
                  <div className="border-t border-gray-200 pt-3 space-y-4">
                    {Array.from({ length: extraRowCount }, (_, i) => {
                      const pickup = additionalPickups[i];
                      const delivery = additionalDeliveries[i];
                      return (
                        <div key={i} className="grid grid-cols-2 gap-4">
                          <div className="space-y-3">
                            {pickup ? (
                              <>
                                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Loading {i + 2}</p>
                                <Field label="Address" value={pickup.address} />
                                {pickup.country && (
                                  <Field label="Country" value={(() => {
                                    const c = countries.all.find(x => x.name.toLowerCase() === pickup.country!.toLowerCase() && x.status === 'assigned');
                                    return (
                                      <span className="flex items-center gap-1.5">
                                        {c && <CircleFlag countryCode={c.alpha2.toLowerCase()} height={16} width={16} />}
                                        {pickup.country}
                                      </span>
                                    );
                                  })()} />
                                )}
                                {pickup.dateBegin && <Field label="Date begin" value={fmt(pickup.dateBegin)} />}
                              </>
                            ) : <div />}
                          </div>
                          <div className="space-y-3">
                            {delivery ? (
                              <>
                                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Delivery {i + 2}</p>
                                <Field label="Address" value={delivery.address} />
                                {delivery.country && (
                                  <Field label="Country" value={(() => {
                                    const c = countries.all.find(x => x.name.toLowerCase() === delivery.country!.toLowerCase() && x.status === 'assigned');
                                    return (
                                      <span className="flex items-center gap-1.5">
                                        {c && <CircleFlag countryCode={c.alpha2.toLowerCase()} height={16} width={16} />}
                                        {delivery.country}
                                      </span>
                                    );
                                  })()} />
                                )}
                                {delivery.dateBegin && <Field label="Date begin" value={fmt(delivery.dateBegin)} />}
                              </>
                            ) : <div />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {order.distanceKm && (
                  <Field label="Distance" value={`${parseFloat(order.distanceKm)} km`} />
                )}
              </div>
            );
          })()}

          {/* Cargo card */}
          <div className="bg-white rounded-xl border border-border p-5 space-y-3"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Cargo</h3>
            {(() => {
              const items = parseDetailCargoItems(order);
              if (!items.length) {
                return <p className="text-sm text-muted-foreground">No cargo information.</p>;
              }
              return (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide pb-1.5 w-14">Qty</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide pb-1.5">Description</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide pb-1.5 w-36">Dimensions</th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide pb-1.5 w-28">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => {
                      const dims = (item.lengthCm || item.widthCm || item.heightCm)
                        ? `${item.lengthCm ?? '—'}×${item.widthCm ?? '—'}×${item.heightCm ?? '—'} cm`
                        : '—';
                      return (
                        <tr key={i} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                          <td className="py-1.5 pr-3 text-gray-900">{item.qty ?? '—'}</td>
                          <td className="py-1.5 pr-3 text-gray-900">{item.description || '—'}</td>
                          <td className="py-1.5 pr-3 text-gray-900">{dims}</td>
                          <td className="py-1.5 text-gray-900">{item.weightKg ? `${item.weightKg} kg` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              );
            })()}
          </div>

          {/* Financials card */}
          <div className="bg-white rounded-xl border border-border p-5 space-y-4"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Financials</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Client price"
                value={order.clientPrice
                  ? `${parseFloat(order.clientPrice).toFixed(2)} ${order.clientCurrency ?? 'EUR'}`
                  : undefined}
              />
              <Field
                label="Transporter price (tarif convenit)"
                value={order.transporterPrice
                  ? `${parseFloat(order.transporterPrice).toFixed(2)} ${order.transporterCurrency ?? 'EUR'}`
                  : undefined}
              />
            </div>
          </div>

          {/* Notes card */}
          {order.notes && (
            <div className="bg-white rounded-xl border border-border p-5 space-y-2"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Additional informations</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}

        </div>

        {/* ── Right: activity log + send status ── */}
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-border p-5"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2 mb-4">Activity</h3>
            <OrderActivityLog entries={activity} isLoading={activityLoading} />
          </div>

          {/* Send status card */}
          <div className="bg-white rounded-xl border border-border p-5 space-y-3"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Trimitere</h3>

            {order.isSent ? (
              <div className="space-y-1">
                <span className="flex items-center justify-center rounded-full bg-emerald-100 text-emerald-700 px-3 py-1.5 text-sm font-medium w-full">
                  Comanda Trimisă
                </span>
                <p className="text-xs text-muted-foreground text-center">{fmt(order.sentAt)}</p>
              </div>
            ) : (
              <span className="flex items-center justify-center rounded-full bg-red-100 text-red-700 px-3 py-1.5 text-sm font-medium w-full">
                Comanda Netrimisă
              </span>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              disabled={sendOrderMutation.isPending}
              onClick={() => setConfirmSend(true)}
            >
              <Send className="h-4 w-4" />
              {sendOrderMutation.isPending ? 'Se trimite…' : (order.isSent ? 'Retrimite Comanda' : 'Trimite Comanda')}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              disabled={downloadPdfMutation.isPending}
              onClick={handleDownloadPdf}
            >
              <Download className="h-4 w-4" />
              {downloadPdfMutation.isPending ? 'Se descarcă…' : 'Descarcă PDF'}
            </Button>
          </div>

          {/* Internal Notes card (private — never shown on PDF) */}
          <div className="bg-white rounded-xl border border-border p-5 flex flex-col gap-2"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div className="flex items-center justify-between border-b pb-2 flex-shrink-0">
              <h3 className="text-sm font-semibold text-gray-500">Notes</h3>
              {!editingNotes && !isArchived && (
                <div className="flex items-center gap-1">
                  {order.internalNotes && (
                    <CopyButton value={order.internalNotes} />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs transition-transform duration-100 active:scale-[0.97]"
                    onClick={handleStartEditNotes}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                </div>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <Textarea
                  ref={notesTextareaRef}
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  maxLength={1024}
                  placeholder="Private notes — not visible on the PDF…"
                  className="text-sm resize-none min-h-[80px]"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{notesValue.length} / 1024</span>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-xs transition-transform duration-100 active:scale-[0.97]"
                      onClick={handleCancelNotes}
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 gap-1.5 text-xs transition-transform duration-100 active:scale-[0.97]"
                      onClick={handleSaveNotes}
                      disabled={updateOrder.isPending}
                    >
                      {updateOrder.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save
                    </Button>
                  </div>
                </div>
              </div>
            ) : order.internalNotes ? (
              <div className="max-h-[100px] overflow-y-auto">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.internalNotes}</p>
              </div>
            ) : (
              <p
                className={`text-sm italic transition-colors duration-150 ${
                  isArchived
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground cursor-pointer hover:text-gray-600 select-none'
                }`}
                onClick={!isArchived ? handleStartEditNotes : undefined}
              >
                No internal notes.
              </p>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmSend}
        title={order.isSent ? 'Retrimiteți comanda?' : 'Trimiteți comanda?'}
        description={order.isSent
          ? `Retrimiteți comanda ${order.orderNumber} către ${order.transporter?.name ?? 'transportator'}?`
          : `Trimiteți comanda ${order.orderNumber} către ${order.transporter?.name ?? 'transportator'}?`}
        confirmLabel={order.isSent ? 'Retrimite' : 'Trimite'}
        pendingLabel="Se trimite…"
        isPending={sendOrderMutation.isPending}
        onCancel={() => setConfirmSend(false)}
        onConfirm={async () => {
          try {
            await sendOrderMutation.mutateAsync(order.id);
            setConfirmSend(false);
            toast({ title: 'Comanda a fost trimisă cu succes.' });
          } catch (err: unknown) {
            const backendMsg =
              (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            toast({
              title: 'Eroare la trimiterea comenzii.',
              description: backendMsg ?? undefined,
              variant: 'destructive',
            });
          }
        }}
      />
    </div>
  );
}
