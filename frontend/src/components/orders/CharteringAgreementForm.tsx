import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, ChevronsUpDown, FileText, Loader2, Minus, NotebookPen, Plus, Save, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { countries } from 'country-data-list';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { CountryDropdown } from '@/components/ui/country-dropdown';
import { DateTimePickerField } from '@/components/ui/date-time-picker-field';
import { cn } from '@/lib/utils';
import { useCreateOrder, useUpdateOrder, usePreviewOrderPdf, useOrdersList } from '@/hooks/useOrders';
import { usePartner, usePartnersList } from '@/hooks/usePartners';
import { useDebounce } from '@/hooks/useDebounce';
import { useVehicle, useVehiclesList } from '@/hooks/useVehicles';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/use-toast';
import { QuickAddPartnerModal } from '@/components/partners/QuickAddPartnerModal';
import { QuickAddVehicleModal } from '@/components/vehicles/QuickAddVehicleModal';
import type { AddressStop, CargoItem, Order, CreateOrderDto } from '@/types/order.types';
import type { Partner } from '@/types/partner.types';
import type { Vehicle } from '@/types/vehicle.types';

// ─── Country auto-detect helper ────────────────────────────────────────────────
// Handles: full ISO names, common aliases, alpha2 (RO/ro), alpha3 (ROU/rou),
// edge cases like ",Romania", "(DE)", "rOmAnIa", "South Korea", "UK", "USA".

// Common name aliases → ISO alpha2 code.
// Needed when everyday names differ from the ISO 3166-1 official name in country-data-list.
const COUNTRY_ALIASES: Record<string, string> = {
  uk: 'GB', 'great britain': 'GB', britain: 'GB', england: 'GB', scotland: 'GB', wales: 'GB',
  usa: 'US', america: 'US',
  russia: 'RU',
  'south korea': 'KR', korea: 'KR',
  'north korea': 'KP',
  uae: 'AE',
  'czech republic': 'CZ',
  'ivory coast': 'CI',
  syria: 'SY',
  iran: 'IR',
  tanzania: 'TZ',
  bolivia: 'BO',
  venezuela: 'VE',
  moldova: 'MD',
  laos: 'LA',
  vietnam: 'VN',
  macedonia: 'MK', 'north macedonia': 'MK',
  burma: 'MM', myanmar: 'MM',
  taiwan: 'TW',
  palestine: 'PS',
  trinidad: 'TT', 'trinidad and tobago': 'TT',
  'st kitts': 'KN', 'saint kitts': 'KN',
  'st lucia': 'LC', 'saint lucia': 'LC',
  'st vincent': 'VC', 'saint vincent': 'VC',
};

function detectCountryFromAddress(text: string): string | null {
  if (!text?.trim()) return null;

  const assigned = countries.all.filter((c) => c.status === 'assigned');

  // Split on whitespace + common punctuation, strip non-letter chars from each token
  const tokens = text
    .split(/[\s,\n;:|()[\]{}'".!?/\\]+/)
    .map((t) => t.replace(/[^a-zA-Z]/g, '').toLowerCase())
    .filter(Boolean);

  if (tokens.length === 0) return null;

  // Phase 1 — ISO full name + alias (windows of 1–4 consecutive tokens)
  for (let start = 0; start < tokens.length; start++) {
    for (let len = Math.min(4, tokens.length - start); len >= 1; len--) {
      const candidate = tokens.slice(start, start + len).join(' ');
      const nameMatch = assigned.find((c) => c.name.toLowerCase() === candidate);
      if (nameMatch) return nameMatch.name;
      const aliasAlpha2 = COUNTRY_ALIASES[candidate];
      if (aliasAlpha2) {
        const aliasMatch = assigned.find((c) => c.alpha2 === aliasAlpha2);
        if (aliasMatch) return aliasMatch.name;
      }
    }
  }

  // Phases 2 & 3 only fire when there are at least 2 tokens — prevents matching
  // short word fragments (e.g. "al" from "Aleea") as country codes.
  if (tokens.length >= 2) {
    // Phase 2 — alpha2 for 2-letter tokens (DE, RO, FR …)
    for (const token of tokens) {
      if (token.length === 2) {
        const match = assigned.find((c) => c.alpha2.toLowerCase() === token);
        if (match) return match.name;
      }
    }

    // Phase 3 — alpha3 for 3-letter tokens (DEU, ROU, FRA, USA …)
    for (const token of tokens) {
      if (token.length === 3) {
        const match = assigned.find(
          (c) => (c as { alpha3?: string }).alpha3?.toLowerCase() === token,
        );
        if (match) return match.name;
      }
    }
  }

  return null;
}

// ─── Zod schema (Zod 3.x — frontend) ─────────────────────────────────────────

const cargoItemSchema = z.object({
  qty: z.coerce.number().int().min(0).optional().or(z.literal(0)),
  description: z.string().optional(),
  lengthCm: z.coerce.number().min(0).optional(),
  widthCm: z.coerce.number().min(0).optional(),
  heightCm: z.coerce.number().min(0).optional(),
  weightKg: z.coerce.number().min(0).optional(),
});

type CargoItemFormValue = z.infer<typeof cargoItemSchema>;

const addressStopSchema = z.object({
  address: z.string().optional(),
  country: z.string().optional(),
  dateBegin: z.string().optional(),
});

type AddressStopFormValue = z.infer<typeof addressStopSchema>;

const schema = z.object({
  clientId: z.number({ required_error: 'Client is required' }).int().positive('Client is required'),
  transporterId: z.number().int().positive().optional(),
  vehicleId: z.number().int().positive().optional(),
  driverName: z.string().optional(),
  contactName: z.string().optional(),
  distanceKm: z.coerce.number().min(0).optional(),
  clientOrderReference: z.string().optional(),
  pickupAddress: z.string().optional(),
  pickupCountry: z.string().optional(),
  pickupDateBegin: z.string().optional(),
  deliveryAddress: z.string().optional(),
  deliveryCountry: z.string().optional(),
  deliveryDateBegin: z.string().optional(),
  additionalPickups: z.array(addressStopSchema).optional(),
  additionalDeliveries: z.array(addressStopSchema).optional(),
  cargoItems: z.array(cargoItemSchema).optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  applyStamp: z.boolean().optional(),
  transporterPrice: z.coerce.number().min(0).optional(),
  transporterCurrency: z.string().optional(),
  clientPrice: z.coerce.number().min(0).optional(),
  clientCurrency: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toIso(localDatetime: string | undefined): string | undefined {
  if (!localDatetime) return undefined;
  try {
    return new Date(localDatetime).toISOString();
  } catch {
    return undefined;
  }
}

const EMPTY_CARGO_ROW: CargoItemFormValue = {
  qty: undefined,
  description: '',
  lengthCm: undefined,
  widthCm: undefined,
  heightCm: undefined,
  weightKg: undefined,
};

const EMPTY_ADDRESS_STOP: AddressStopFormValue = {
  address: '',
  country: '',
  dateBegin: '',
};

function parseAddressStops(json: string | null): AddressStopFormValue[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as AddressStop[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((s) => ({
        address: s.address ?? '',
        country: s.country ?? '',
        dateBegin: s.dateBegin ?? '',
      }));
    }
  } catch {
    // ignore malformed JSON
  }
  return [];
}

function parseCargoItems(order: Order): CargoItemFormValue[] {
  if (order.cargoItemsJson) {
    try {
      const parsed = JSON.parse(order.cargoItemsJson) as CargoItem[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((i) => ({
          qty: i.qty ?? undefined,
          description: i.description ?? '',
          lengthCm: i.lengthCm ?? undefined,
          widthCm: i.widthCm ?? undefined,
          heightCm: i.heightCm ?? undefined,
          weightKg: i.weightKg ?? undefined,
        }));
      }
    } catch {
      // fall through to legacy fields
    }
  }
  // Backward compat: old order with individual cargo fields
  if (order.cargoQuantity || order.cargoDescription || order.cargoWeightKg) {
    return [{
      qty: order.cargoQuantity ?? undefined,
      description: order.cargoDescription ?? '',
      lengthCm: order.cargoLengthCm ? Number(order.cargoLengthCm) : undefined,
      widthCm: order.cargoWidthCm ? Number(order.cargoWidthCm) : undefined,
      heightCm: order.cargoHeightCm ? Number(order.cargoHeightCm) : undefined,
      weightKg: order.cargoWeightKg ? Number(order.cargoWeightKg) : undefined,
    }];
  }
  return [{ ...EMPTY_CARGO_ROW }];
}

function buildDto(values: FormValues): CreateOrderDto {
  const dto: CreateOrderDto = { clientId: values.clientId };
  if (values.transporterId) dto.transporterId = values.transporterId;
  if (values.vehicleId) dto.vehicleId = values.vehicleId;
  if (values.driverName?.trim()) dto.driverName = values.driverName.trim();
  if (values.distanceKm !== undefined && values.distanceKm >= 0) dto.distanceKm = values.distanceKm;
  if (values.clientOrderReference?.trim()) dto.clientOrderReference = values.clientOrderReference.trim();
  if (values.pickupAddress?.trim()) dto.pickupAddress = values.pickupAddress.trim();
  if (values.pickupCountry?.trim()) dto.pickupCountry = values.pickupCountry.trim();
  const pickupDateBegin = toIso(values.pickupDateBegin);
  if (pickupDateBegin) dto.pickupDateBegin = pickupDateBegin;
  if (values.deliveryAddress?.trim()) dto.deliveryAddress = values.deliveryAddress.trim();
  if (values.deliveryCountry?.trim()) dto.deliveryCountry = values.deliveryCountry.trim();
  const deliveryDateBegin = toIso(values.deliveryDateBegin);
  if (deliveryDateBegin) dto.deliveryDateBegin = deliveryDateBegin;
  if (values.cargoItems?.length) dto.cargoItems = values.cargoItems;
  const normalizeStop = (s: AddressStopFormValue) => ({
    ...(s.address?.trim() && { address: s.address.trim() }),
    ...(s.country?.trim() && { country: s.country.trim() }),
    ...(toIso(s.dateBegin) && { dateBegin: toIso(s.dateBegin) }),
  });
  const filteredPickups = (values.additionalPickups ?? [])
    .filter((s) => s.address?.trim() || s.country?.trim() || s.dateBegin?.trim())
    .map(normalizeStop);
  dto.additionalPickups = filteredPickups;
  const filteredDeliveries = (values.additionalDeliveries ?? [])
    .filter((s) => s.address?.trim() || s.country?.trim() || s.dateBegin?.trim())
    .map(normalizeStop);
  dto.additionalDeliveries = filteredDeliveries;
  if (values.notes?.trim()) dto.notes = values.notes.trim();
  if (values.internalNotes?.trim()) dto.internalNotes = values.internalNotes.trim();
  if (values.applyStamp) dto.applyStamp = values.applyStamp;
  if (values.transporterPrice !== undefined && values.transporterPrice >= 0) dto.transporterPrice = values.transporterPrice;
  dto.transporterCurrency = values.transporterCurrency || 'EUR';
  if (values.clientPrice !== undefined && values.clientPrice >= 0) dto.clientPrice = values.clientPrice;
  dto.clientCurrency = values.clientCurrency || 'EUR';
  return dto;
}

function getDefaultValues(order?: Order): FormValues {
  if (!order) {
    return {
      clientId: 0 as unknown as number,
      transporterCurrency: 'EUR',
      clientCurrency: 'EUR',
      cargoItems: [{ ...EMPTY_CARGO_ROW }],
      additionalPickups: [],
      additionalDeliveries: [],
      applyStamp: false,
    };
  }
  return {
    clientId: order.clientId,
    transporterId: order.transporterId ?? undefined,
    vehicleId: order.vehicleId ?? undefined,
    driverName: order.driverName ?? '',
    contactName: order.contactName ?? '',
    distanceKm: order.distanceKm ? Number(order.distanceKm) : undefined,
    clientOrderReference: order.clientOrderReference ?? '',
    pickupAddress: order.pickupAddress ?? '',
    pickupCountry: order.pickupCountry ?? '',
    pickupDateBegin: order.pickupDateBegin ?? '',
    deliveryAddress: order.deliveryAddress ?? '',
    deliveryCountry: order.deliveryCountry ?? '',
    deliveryDateBegin: order.deliveryDateBegin ?? '',
    additionalPickups: parseAddressStops(order.additionalPickupsJson),
    additionalDeliveries: parseAddressStops(order.additionalDeliveriesJson),
    cargoItems: parseCargoItems(order),
    notes: order.notes ?? '',
    internalNotes: order.internalNotes ?? '',
    transporterPrice: order.transporterPrice ? Number(order.transporterPrice) : undefined,
    transporterCurrency: order.transporterCurrency ?? 'EUR',
    clientPrice: order.clientPrice ? Number(order.clientPrice) : undefined,
    clientCurrency: order.clientCurrency ?? 'EUR',
    applyStamp: order.applyStamp ?? false,
  };
}

// ─── Combobox component (reusable within this file) ───────────────────────────

interface ComboboxOption {
  id: number;
  label: string;
  badge?: { text: string; className: string };
}

interface ComboboxProps {
  value: number | undefined;
  onChange: (id: number | undefined) => void;
  options: ComboboxOption[];
  placeholder: string;
  searchPlaceholder?: string;
  className?: string;
  addNewLabel?: string;
  onAddNew?: () => void;
  onSearchChange?: (value: string) => void;
}

function Combobox({ value, onChange, options, placeholder, searchPlaceholder, className, addNewLabel, onAddNew, onSearchChange }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('justify-between font-normal', className)}
        >
          <span className="truncate">
            {selected?.label ?? placeholder}
            {selected?.badge && (
              <span className={cn('ml-1.5 inline-flex items-center rounded px-1 py-0.5 text-[10px] font-medium leading-none', selected.badge.className)}>
                {selected.badge.text}
              </span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command filter={onSearchChange ? () => 1 : undefined}>
          <CommandInput placeholder={searchPlaceholder ?? 'Search…'} onValueChange={onSearchChange} />
          <CommandList className="max-h-[200px]">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {value !== undefined && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => { onChange(undefined); setOpen(false); }}
                  className="text-muted-foreground"
                >
                  — Clear selection —
                </CommandItem>
              )}
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={opt.label}
                  onSelect={() => { onChange(opt.id); setOpen(false); }}
                >
                  <Check className={cn('mr-2 h-4 w-4', opt.id === value ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{opt.label}</span>
                  {opt.badge && (
                    <span className={cn('ml-auto shrink-0 rounded px-1 py-0.5 text-[10px] font-medium leading-none', opt.badge.className)}>
                      {opt.badge.text}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {onAddNew && (
            <div className="border-t border-gray-100 p-1">
              <div
                role="button"
                tabIndex={0}
                className="flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm text-blue-600 font-medium hover:bg-accent hover:text-blue-700"
                onClick={() => { setOpen(false); onAddNew(); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setOpen(false); onAddNew(); } }}
              >
                <Plus className="mr-2 h-4 w-4" />
                {addNewLabel ?? 'Add new…'}
              </div>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CharteringAgreementFormProps {
  order?: Order;
  onClose: () => void;
  onSaved?: (order: Order) => void;
}

export function CharteringAgreementForm({ order, onClose, onSaved }: CharteringAgreementFormProps) {
  const { data: settings } = useSettings();

  const createOrder = useCreateOrder();
  const updateOrder = useUpdateOrder();
  const previewPdf = usePreviewOrderPdf();
  const { toast } = useToast();

  const isEdit = Boolean(order);
  const todayLabel = format(new Date(), 'MMMM d, yyyy');

  // Quick Add modal state
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [transporterModalOpen, setTransporterModalOpen] = useState(false);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);

  // Newly quick-added items are kept in local state so they appear immediately
  // in the combobox without waiting for the React Query refetch to complete.
  const [extraPartners, setExtraPartners] = useState<Partner[]>([]);
  const [extraVehicles, setExtraVehicles] = useState<Vehicle[]>([]);

  // Track whether each country field was set by auto-detection ('auto') or manually
  // by the user via the dropdown ('manual'). Auto-detected values are always
  // overwritten by better detection; manual choices are preserved.
  const pickupCountrySource = useRef<'none' | 'auto' | 'manual'>('none');
  const deliveryCountrySource = useRef<'none' | 'auto' | 'manual'>('none');

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: getDefaultValues(order),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'cargoItems',
  });

  const { fields: pickupFields, append: appendPickup, remove: removePickup } = useFieldArray({
    control: form.control,
    name: 'additionalPickups',
  });

  const { fields: deliveryFields, append: appendDelivery, remove: removeDelivery } = useFieldArray({
    control: form.control,
    name: 'additionalDeliveries',
  });

  // Per-field search state + debounce (server-side filtering)
  const watchedClientId = form.watch('clientId');
  const watchedTransporterId = form.watch('transporterId');
  const watchedVehicleId = form.watch('vehicleId');
  const [clientSearch, setClientSearch] = useState('');
  const [transporterSearch, setTransporterSearch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const debouncedClientSearch = useDebounce(clientSearch, 300);
  const debouncedTransporterSearch = useDebounce(transporterSearch, 300);
  const debouncedVehicleSearch = useDebounce(vehicleSearch, 300);

  // Per-field queries — initial 50 alphabetical; narrows as user types
  const { data: clientPartnersData } = usePartnersList(1, 50, debouncedClientSearch || undefined);
  const { data: transporterPartnersData } = usePartnersList(1, 50, debouncedTransporterSearch || undefined);
  const { data: vehiclesData } = useVehiclesList(1, 50, debouncedVehicleSearch || undefined);

  // Fetch selected items by ID for edit mode — ensures CUI/Address/Phone always show
  // even if the selected partner/vehicle is not in the current 50-item search slice.
  const { data: selectedClientPartner } = usePartner(watchedClientId || 0);
  const { data: selectedTransporterPartner } = usePartner(watchedTransporterId || 0);
  const { data: selectedVehicleData } = useVehicle(watchedVehicleId || 0);

  const dedupe = <T extends { id: number }>(items: T[]): T[] =>
    items.filter((item, idx, arr) => arr.findIndex((x) => x.id === item.id) === idx);

  // Merge search results + selected item + Quick Add items — deduplicated by ID
  const mergedClientPartners = dedupe([
    ...(clientPartnersData?.items ?? []),
    ...(selectedClientPartner ? [selectedClientPartner] : []),
    ...extraPartners,
  ]);
  const mergedTransporterPartners = dedupe([
    ...(transporterPartnersData?.items ?? []),
    ...(selectedTransporterPartner ? [selectedTransporterPartner] : []),
    ...extraPartners,
  ]);
  const mergedVehicles = dedupe([
    ...(vehiclesData?.items ?? []),
    ...(selectedVehicleData ? [selectedVehicleData] : []),
    ...extraVehicles,
  ]);

  const clientOptions: ComboboxOption[] = mergedClientPartners.map((p) => ({ id: p.id, label: p.name }));
  const transporterOptions: ComboboxOption[] = mergedTransporterPartners.map((p) => ({ id: p.id, label: p.name }));

  // Filter out INACTIVE vehicles, sort AVAILABLE first, add status badges
  const VEHICLE_STATUS_ORDER: Record<string, number> = { AVAILABLE: 0, ON_ROUTE: 1, MAINTENANCE: 2 };
  const VEHICLE_STATUS_BADGE: Record<string, { text: string; className: string } | undefined> = {
    ON_ROUTE: { text: 'On route', className: 'bg-amber-100 text-amber-700' },
    MAINTENANCE: { text: 'Maintenance', className: 'bg-orange-100 text-orange-700' },
  };
  const vehicleOptions: ComboboxOption[] = mergedVehicles
    .filter((v) => v.status !== 'INACTIVE')
    .sort((a, b) => (VEHICLE_STATUS_ORDER[a.status] ?? 9) - (VEHICLE_STATUS_ORDER[b.status] ?? 9))
    .map((v) => ({
      id: v.id,
      label: v.licensePlate,
      badge: VEHICLE_STATUS_BADGE[v.status],
    }));

  const selectedClientName = clientOptions.find((p) => p.id === watchedClientId)?.label;
  const selectedTransporterName = transporterOptions.find((p) => p.id === watchedTransporterId)?.label;
  const selectedTransporter = mergedTransporterPartners.find((p) => p.id === watchedTransporterId);
  const selectedVehicle = mergedVehicles.find((v) => v.id === watchedVehicleId);
  const vehicleIsOnRoute = selectedVehicle?.status === 'ON_ROUTE';
  const { data: activeVehicleOrdersData } = useOrdersList(
    1, 5,
    vehicleIsOnRoute ? { vehicleId: selectedVehicle!.id, status: 'IN_PROGRESS' } : {},
    { enabled: vehicleIsOnRoute },
  );
  const activeVehicleOrders = vehicleIsOnRoute ? (activeVehicleOrdersData?.items ?? []) : [];

  const handlePreviewPdf = async () => {
    const values = form.getValues();
    if (!values.clientId) {
      toast({ title: 'Select a client first', variant: 'destructive' });
      return;
    }
    try {
      const dto = buildDto(values);
      if (order?.orderNumber) dto.orderNumber = order.orderNumber;
      await previewPdf.mutateAsync(dto);
    } catch {
      toast({ title: 'Failed to generate PDF preview', variant: 'destructive' });
    }
  };

  const onSubmit = async (values: FormValues) => {
    const allStops = [...(values.additionalPickups ?? []), ...(values.additionalDeliveries ?? [])];
    const missingDate = allStops.some(
      (s) => (s.address?.trim() || s.country?.trim()) && !s.dateBegin?.trim(),
    );
    if (missingDate) {
      toast({
        title: 'Date & time required',
        description: 'Please add a date and time for each additional loading/delivery address.',
        variant: 'destructive',
      });
      return;
    }
    const dto = buildDto(values);
    try {
      if (isEdit && order) {
        const updated = await updateOrder.mutateAsync({ id: order.id, dto });
        toast({ title: `Order ${updated.orderNumber} updated` });
        if (onSaved) {
          onSaved(updated);
        } else {
          onClose();
        }
      } else {
        const created = await createOrder.mutateAsync(dto);
        toast({ title: `Order ${created.orderNumber} created` });
        if (onSaved) {
          onSaved(created);
        } else {
          onClose();
        }
      }
    } catch {
      toast({ title: isEdit ? 'Failed to update order' : 'Failed to create order', variant: 'destructive' });
    }
  };

  const isSaving = createOrder.isPending || updateOrder.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pb-8">

        {/* ── Client selector (above the document card) ── */}
        <div className="max-w-[820px] mx-auto">
          <FormField
            control={form.control}
            name="clientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client <span className="text-destructive">★</span></FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value || undefined}
                    onChange={(id) => field.onChange(id ?? 0)}
                    options={clientOptions}
                    placeholder="Select client…"
                    searchPlaceholder="Search partners…"
                    className="w-full"
                    addNewLabel="Add new partner"
                    onAddNew={() => setClientModalOpen(true)}
                    onSearchChange={setClientSearch}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* ── Document card ── */}
        <div className="max-w-[820px] mx-auto bg-white rounded-xl shadow-lg border border-gray-200 p-8 space-y-5">

          {/* Header row */}
          <div className="flex justify-between items-start">
            <div>
              {settings?.companyLogoPath ? (
                <img
                  src={`/api/${settings.companyLogoPath}`}
                  alt="Company Logo"
                  className="max-h-[60px] max-w-[180px] object-contain"
                />
              ) : (
                <div className="text-xl font-bold text-blue-800 tracking-wide">
                  {settings?.companyName || 'TMS'}
                </div>
              )}
            </div>
            <div className="text-right text-xs text-gray-600 space-y-1">
              <div className="text-sm italic text-gray-500 mb-1">{todayLabel}</div>
              {/* "Your contact" replaced with read-only company name */}
              <div className="text-sm font-semibold text-gray-800">
                {settings?.companyName || ''}
              </div>
              {settings?.companyVatCode && <div>CUI: {settings.companyVatCode}</div>}
              {settings?.companyPhone && <div>Tel: {settings.companyPhone}</div>}
              {settings?.smtpEmail && <div>Email: {settings.smtpEmail}</div>}
              {settings?.companyAddress && <div>{settings.companyAddress}</div>}
            </div>
          </div>

          {/* Title block */}
          <div className="text-center border-t-2 border-b border-blue-800 border-b-gray-200 py-3 space-y-1">
            <h2 className="text-base font-bold tracking-widest text-blue-800 uppercase">
              Shipping Order
            </h2>
            <p className="text-sm font-semibold">
              Order number:{' '}
              <span className="text-blue-700">
                {order?.orderNumber ?? 'Will be assigned on save'}
              </span>
            </p>
            <p className="text-xs italic text-gray-400">(To recall in your invoice)</p>
          </div>

          {/* SUBCONTRACTOR box */}
          <div className="border border-gray-300 rounded-md p-4 bg-gray-50 space-y-3">
            {/* Transporter */}
            <div className="grid grid-cols-[130px_1fr] items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Subcontractor:</span>
              <FormField
                control={form.control}
                name="transporterId"
                render={({ field }) => (
                  <FormItem className="mb-0 space-y-0">
                    <FormControl>
                      <Combobox
                        value={field.value}
                        onChange={(id) => field.onChange(id)}
                        options={transporterOptions}
                        placeholder="Select transporter…"
                        searchPlaceholder="Search transporters…"
                        className="w-full h-8 text-sm"
                        addNewLabel="Add new partner"
                        onAddNew={() => setTransporterModalOpen(true)}
                        onSearchChange={setTransporterSearch}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            {selectedTransporter && (
              <div className="pl-[142px] text-xs text-gray-500 space-y-0.5 -mt-1">
                {selectedTransporter.fiscalCode && (
                  <div><span className="font-semibold">CUI:</span> {selectedTransporter.fiscalCode}</div>
                )}
                {selectedTransporter.addressLine1 && (
                  <div><span className="font-semibold">Address:</span> {selectedTransporter.addressLine1}</div>
                )}
                {selectedTransporter.phone && (
                  <div><span className="font-semibold">Phone:</span> {selectedTransporter.phone}</div>
                )}
                {selectedTransporter.email && (
                  <div><span className="font-semibold">Email:</span> {selectedTransporter.email}</div>
                )}
              </div>
            )}

            {/* Vehicle */}
            <div className="grid grid-cols-[130px_1fr] items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Vehicle:</span>
              <FormField
                control={form.control}
                name="vehicleId"
                render={({ field }) => (
                  <FormItem className="mb-0 space-y-0">
                    <FormControl>
                      <Combobox
                        value={field.value}
                        onChange={(id) => field.onChange(id)}
                        options={vehicleOptions}
                        placeholder="Select vehicle…"
                        searchPlaceholder="Search plates…"
                        className="w-full h-8 text-sm"
                        addNewLabel="Add new vehicle"
                        onAddNew={() => setVehicleModalOpen(true)}
                        onSearchChange={setVehicleSearch}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Vehicle on route warning */}
            {vehicleIsOnRoute && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <span>
                  Vehicle {selectedVehicle!.licensePlate} is currently on route.
                  {activeVehicleOrders.length > 0 && (
                    <> Active shipment{activeVehicleOrders.length > 1 ? 's' : ''}: <span className="font-semibold">{activeVehicleOrders.map((o) => o.orderNumber).join(', ')}</span></>
                  )}
                </span>
              </div>
            )}

            {/* Driver */}
            <div className="grid grid-cols-[130px_1fr] items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Driver:</span>
              <FormField
                control={form.control}
                name="driverName"
                render={({ field }) => (
                  <FormItem className="mb-0 space-y-0">
                    <FormControl>
                      <Input {...field} placeholder="Driver name" className="h-8 text-sm" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Distance */}
            <div className="grid grid-cols-[130px_1fr] items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Distance:</span>
              <FormField
                control={form.control}
                name="distanceKm"
                render={({ field }) => (
                  <FormItem className="mb-0 space-y-0">
                    <FormControl>
                      <div className="flex items-center gap-1">
                        <Input
                          {...field}
                          type="number"
                          min={0}
                          step="1"
                          placeholder="0"
                          className="h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                          onWheel={(e) => e.currentTarget.blur()}
                        />
                        <span className="text-xs text-gray-500 whitespace-nowrap">km</span>
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Reference */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold whitespace-nowrap">Reference:</span>
            <FormField
              control={form.control}
              name="clientOrderReference"
              render={({ field }) => (
                <FormItem className="flex-1 mb-0 space-y-0">
                  <FormControl>
                    <Input {...field} placeholder="Client order reference" className="h-8 text-sm" />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {/* Address grid */}
          <div className="grid grid-cols-2 gap-0 border border-gray-300 rounded-md overflow-hidden">
            {/* Loading Address */}
            <div className="p-4 border-r border-gray-300 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wide text-blue-800 border-b border-gray-200 pb-1">
                Loading Address
              </h4>
              {/* Country flag dropdown */}
              <FormField
                control={form.control}
                name="pickupCountry"
                render={({ field }) => (
                  <FormItem className="mb-0 space-y-0">
                    <FormControl>
                      <CountryDropdown
                        value={field.value ?? ''}
                        onChange={(val) => {
                          field.onChange(val);
                          pickupCountrySource.current = val ? 'manual' : 'none';
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pickupAddress"
                render={({ field }) => (
                  <FormItem className="mb-0 space-y-0">
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Full pickup address…"
                        className="text-sm resize-none min-h-[60px]"
                        onChange={(e) => {
                          field.onChange(e);
                          if (pickupCountrySource.current !== 'manual') {
                            if (!e.target.value.trim()) {
                              form.setValue('pickupCountry', '');
                              pickupCountrySource.current = 'none';
                            } else {
                              const detected = detectCountryFromAddress(e.target.value);
                              if (detected) {
                                form.setValue('pickupCountry', detected);
                                pickupCountrySource.current = 'auto';
                              }
                            }
                          }
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pickupDateBegin"
                render={({ field }) => (
                  <FormItem className="mb-0 space-y-0">
                    <FormControl>
                      <DateTimePickerField
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        name={field.name}
                        id={field.name}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Delivery Address */}
            <div className="p-4 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wide text-blue-800 border-b border-gray-200 pb-1">
                Delivery Address
              </h4>
              {/* Country flag dropdown */}
              <FormField
                control={form.control}
                name="deliveryCountry"
                render={({ field }) => (
                  <FormItem className="mb-0 space-y-0">
                    <FormControl>
                      <CountryDropdown
                        value={field.value ?? ''}
                        onChange={(val) => {
                          field.onChange(val);
                          deliveryCountrySource.current = val ? 'manual' : 'none';
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deliveryAddress"
                render={({ field }) => (
                  <FormItem className="mb-0 space-y-0">
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Full delivery address…"
                        className="text-sm resize-none min-h-[60px]"
                        onChange={(e) => {
                          field.onChange(e);
                          if (deliveryCountrySource.current !== 'manual') {
                            if (!e.target.value.trim()) {
                              form.setValue('deliveryCountry', '');
                              deliveryCountrySource.current = 'none';
                            } else {
                              const detected = detectCountryFromAddress(e.target.value);
                              if (detected) {
                                form.setValue('deliveryCountry', detected);
                                deliveryCountrySource.current = 'auto';
                              }
                            }
                          }
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deliveryDateBegin"
                render={({ field }) => (
                  <FormItem className="mb-0 space-y-0">
                    <FormControl>
                      <DateTimePickerField
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        name={field.name}
                        id={field.name}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Additional address rows (extra loading / delivery stops) */}
          {(pickupFields.length > 0 || deliveryFields.length > 0) && (
            <div className="space-y-0 border border-t-0 border-gray-300 rounded-b-md -mt-2 overflow-hidden">
              {Array.from({ length: Math.max(pickupFields.length, deliveryFields.length) }, (_, i) => (
                <div key={i} className="grid grid-cols-2 gap-0 border-t border-gray-300">
                  {/* Additional Loading */}
                  <div className="p-4 border-r border-gray-300">
                    {pickupFields[i] ? (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wide text-blue-800 border-b border-gray-200 pb-1 flex-1">
                            Loading Address {i + 2}
                          </h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-gray-400 hover:text-red-500 -mt-1 transition-colors duration-150 active:scale-[0.90]"
                            onClick={() => removePickup(i)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <FormField
                          control={form.control}
                          name={`additionalPickups.${i}.country`}
                          render={({ field: f }) => (
                            <FormItem className="mb-0 space-y-0">
                              <FormControl>
                                <CountryDropdown value={f.value ?? ''} onChange={f.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`additionalPickups.${i}.address`}
                          render={({ field: f }) => (
                            <FormItem className="mb-0 space-y-0">
                              <FormControl>
                                <Textarea
                                  {...f}
                                  placeholder="Full pickup address…"
                                  className="text-sm resize-none min-h-[60px]"
                                  onChange={(e) => {
                                    f.onChange(e);
                                    const currentCountry = form.getValues(`additionalPickups.${i}.country`);
                                    if (!e.target.value.trim()) {
                                      if (!currentCountry) return;
                                      form.setValue(`additionalPickups.${i}.country`, '');
                                    } else if (!currentCountry) {
                                      const detected = detectCountryFromAddress(e.target.value);
                                      if (detected) form.setValue(`additionalPickups.${i}.country`, detected);
                                    }
                                  }}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`additionalPickups.${i}.dateBegin`}
                          render={({ field: f }) => (
                            <FormItem className="mb-0 space-y-0">
                              <FormControl>
                                <DateTimePickerField
                                  value={f.value ?? ''}
                                  onChange={f.onChange}
                                  name={f.name}
                                  id={f.name}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    ) : (
                      <div className="h-full" />
                    )}
                  </div>

                  {/* Additional Delivery */}
                  <div className="p-4">
                    {deliveryFields[i] ? (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wide text-blue-800 border-b border-gray-200 pb-1 flex-1">
                            Delivery Address {i + 2}
                          </h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-gray-400 hover:text-red-500 -mt-1 transition-colors duration-150 active:scale-[0.90]"
                            onClick={() => removeDelivery(i)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <FormField
                          control={form.control}
                          name={`additionalDeliveries.${i}.country`}
                          render={({ field: f }) => (
                            <FormItem className="mb-0 space-y-0">
                              <FormControl>
                                <CountryDropdown value={f.value ?? ''} onChange={f.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`additionalDeliveries.${i}.address`}
                          render={({ field: f }) => (
                            <FormItem className="mb-0 space-y-0">
                              <FormControl>
                                <Textarea
                                  {...f}
                                  placeholder="Full delivery address…"
                                  className="text-sm resize-none min-h-[60px]"
                                  onChange={(e) => {
                                    f.onChange(e);
                                    const currentCountry = form.getValues(`additionalDeliveries.${i}.country`);
                                    if (!e.target.value.trim()) {
                                      if (!currentCountry) return;
                                      form.setValue(`additionalDeliveries.${i}.country`, '');
                                    } else if (!currentCountry) {
                                      const detected = detectCountryFromAddress(e.target.value);
                                      if (detected) form.setValue(`additionalDeliveries.${i}.country`, detected);
                                    }
                                  }}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`additionalDeliveries.${i}.dateBegin`}
                          render={({ field: f }) => (
                            <FormItem className="mb-0 space-y-0">
                              <FormControl>
                                <DateTimePickerField
                                  value={f.value ?? ''}
                                  onChange={f.onChange}
                                  name={f.name}
                                  id={f.name}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    ) : (
                      <div className="h-full" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add loading / delivery address buttons */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs text-blue-700 border-blue-300 hover:bg-blue-50 transition-colors duration-150 active:scale-[0.97]"
              onClick={() => appendPickup({ ...EMPTY_ADDRESS_STOP })}
              disabled={pickupFields.length >= 20}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Loading Address
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs text-blue-700 border-blue-300 hover:bg-blue-50 transition-colors duration-150 active:scale-[0.97]"
              onClick={() => appendDelivery({ ...EMPTY_ADDRESS_STOP })}
              disabled={deliveryFields.length >= 20}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Delivery Address
            </Button>
          </div>

          {/* Cargo section — dynamic rows via useFieldArray */}
          {/* Note: Using plain div+label (not FormItem/FormLabel) for inline multi-field rows */}
          <div className="space-y-2">
            {/* Column headers */}
            <div className="grid grid-cols-[80px_1fr_72px_72px_72px_96px_32px] gap-2">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Qty</label>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Goods</label>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">L (cm)</label>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">W (cm)</label>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">H (cm)</label>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Weight (kg)</label>
              <div />
            </div>

            {/* Cargo rows */}
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-[80px_1fr_72px_72px_72px_96px_32px] gap-2 items-center">
                <FormField
                  control={form.control}
                  name={`cargoItems.${index}.qty`}
                  render={({ field: f }) => (
                    <FormItem className="mb-0 space-y-0">
                      <FormControl>
                        <Input
                          {...f}
                          type="number"
                          min={0}
                          placeholder="0"
                          className="h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={f.value ?? ''}
                          onChange={(e) => f.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                          onWheel={(e) => e.currentTarget.blur()}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`cargoItems.${index}.description`}
                  render={({ field: f }) => (
                    <FormItem className="mb-0 space-y-0">
                      <FormControl>
                        <Input {...f} placeholder="Description" className="h-8 text-sm" />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`cargoItems.${index}.lengthCm`}
                  render={({ field: f }) => (
                    <FormItem className="mb-0 space-y-0">
                      <FormControl>
                        <Input
                          {...f}
                          type="number"
                          min={0}
                          step="1.0"
                          placeholder="0"
                          className="h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={f.value ?? ''}
                          onChange={(e) => f.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                          onWheel={(e) => e.currentTarget.blur()}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`cargoItems.${index}.widthCm`}
                  render={({ field: f }) => (
                    <FormItem className="mb-0 space-y-0">
                      <FormControl>
                        <Input
                          {...f}
                          type="number"
                          min={0}
                          step="1.0"
                          placeholder="0"
                          className="h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={f.value ?? ''}
                          onChange={(e) => f.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                          onWheel={(e) => e.currentTarget.blur()}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`cargoItems.${index}.heightCm`}
                  render={({ field: f }) => (
                    <FormItem className="mb-0 space-y-0">
                      <FormControl>
                        <Input
                          {...f}
                          type="number"
                          min={0}
                          step="1.0"
                          placeholder="0"
                          className="h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={f.value ?? ''}
                          onChange={(e) => f.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                          onWheel={(e) => e.currentTarget.blur()}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`cargoItems.${index}.weightKg`}
                  render={({ field: f }) => (
                    <FormItem className="mb-0 space-y-0">
                      <FormControl>
                        <Input
                          {...f}
                          type="number"
                          min={0}
                          step="1.0"
                          placeholder="0"
                          className="h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={f.value ?? ''}
                          onChange={(e) => f.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                          onWheel={(e) => e.currentTarget.blur()}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-red-500"
                  disabled={fields.length <= 1}
                  onClick={() => remove(index)}
                >
                  <Minus className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {/* Add row button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-1 h-7 text-xs text-blue-700 border-blue-300 hover:bg-blue-50"
              onClick={() => append({ ...EMPTY_CARGO_ROW })}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add cargo row
            </Button>
          </div>

          {/* Notes */}
          <div className="border border-gray-300 rounded-md p-4 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-blue-800">
              Additional informations :
            </h4>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="mb-0 space-y-0">
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Any special instructions or notes…"
                      className="text-sm resize-none min-h-[60px] border-0 p-0 focus-visible:ring-0 shadow-none"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {/* Bottom grid: stamp + tarif */}
          <div className="grid grid-cols-2 gap-0 border border-gray-300 rounded-md overflow-hidden">
            <div className="p-4 border-r border-gray-300 min-h-[80px]">
              <h4 className="text-xs font-bold uppercase tracking-wide text-blue-800 mb-2">
                Commercial stamp :
              </h4>
              <div className="flex items-center gap-2 mt-1">
                <Checkbox
                  id="applyStamp"
                  checked={form.watch('applyStamp') ?? false}
                  onCheckedChange={(checked) => form.setValue('applyStamp', checked === true)}
                  disabled={!settings?.companyStampPath}
                />
                <label
                  htmlFor="applyStamp"
                  className={cn(
                    'text-xs select-none',
                    settings?.companyStampPath ? 'cursor-pointer' : 'text-gray-400 cursor-not-allowed',
                  )}
                >
                  {settings?.companyStampPath
                    ? 'Apply electronic stamp'
                    : 'Apply electronic stamp (no stamp in Settings)'}
                </label>
              </div>
            </div>
            <div className="p-4 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wide text-blue-800">
                Tarif convenit :
              </h4>
              <div className="flex items-center gap-2">
                <FormField
                  control={form.control}
                  name="transporterPrice"
                  render={({ field }) => (
                    <FormItem className="mb-0 space-y-0 flex-1">
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="0.00"
                          className="text-lg font-bold text-blue-800 h-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                          onWheel={(e) => e.currentTarget.blur()}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <span className="text-lg font-bold text-blue-800">€</span>
              </div>
            </div>
          </div>

          {/* Client price row */}
          <div className="flex items-center gap-3 bg-gray-50 rounded-md px-4 py-2 border border-gray-200">
            <span className="text-sm font-medium text-gray-600 whitespace-nowrap">Client price:</span>
            <FormField
              control={form.control}
              name="clientPrice"
              render={({ field }) => (
                <FormItem className="mb-0 space-y-0 w-36">
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      className="h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                      onWheel={(e) => e.currentTarget.blur()}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <span className="text-sm text-gray-500">EUR</span>
            <div className="flex-1" />
            {selectedClientName && (
              <span className="text-xs text-gray-400">Client: <strong>{selectedClientName}</strong></span>
            )}
            {selectedTransporterName && (
              <span className="text-xs text-gray-400">Carrier: <strong>{selectedTransporterName}</strong></span>
            )}
          </div>
        </div>

        {/* ── Internal Notes ── */}
        <div className="max-w-[820px] mx-auto">
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              <NotebookPen className="h-3.5 w-3.5" />
              Internal Notes
            </div>
            <FormField
              control={form.control}
              name="internalNotes"
              render={({ field }) => (
                <FormItem className="mb-0 space-y-0">
                  <FormControl>
                    <Textarea
                      {...field}
                      maxLength={1024}
                      placeholder="Driver preferences, special handling instructions, internal remarks…"
                      className="text-sm resize-none min-h-[72px] bg-white"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <span className="text-xs text-gray-400">{(form.watch('internalNotes') ?? '').length} / 1024</span>
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="max-w-[820px] mx-auto flex justify-between gap-3">
          <Button type="button" variant="destructive" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handlePreviewPdf}
              disabled={previewPdf.isPending}
            >
              {previewPdf.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Preview PDF
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isEdit ? 'Update Order' : 'Create Order'}
            </Button>
          </div>
        </div>

        {/* ── Quick Add Modals ── */}
        <QuickAddPartnerModal
          open={clientModalOpen}
          onClose={() => setClientModalOpen(false)}
          defaultPartnerType="CLIENT"
          onCreated={(p: Partner) => {
            setExtraPartners((prev) => [...prev.filter((x) => x.id !== p.id), p]);
            form.setValue('clientId', p.id);
            setClientModalOpen(false);
          }}
        />
        <QuickAddPartnerModal
          open={transporterModalOpen}
          onClose={() => setTransporterModalOpen(false)}
          defaultPartnerType="TRANSPORTER"
          onCreated={(p: Partner) => {
            setExtraPartners((prev) => [...prev.filter((x) => x.id !== p.id), p]);
            form.setValue('transporterId', p.id);
            setTransporterModalOpen(false);
          }}
        />
        <QuickAddVehicleModal
          open={vehicleModalOpen}
          onClose={() => setVehicleModalOpen(false)}
          transporterId={form.watch('transporterId')}
          onCreated={(v: Vehicle) => {
            setExtraVehicles((prev) => [...prev.filter((x) => x.id !== v.id), v]);
            form.setValue('vehicleId', v.id);
            setVehicleModalOpen(false);
          }}
        />

      </form>
    </Form>
  );
}
