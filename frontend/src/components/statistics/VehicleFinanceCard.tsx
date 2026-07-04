import { useState, useMemo } from 'react';
import { subDays, format } from 'date-fns';
import { Check, ChevronDown, X } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { DateRangePickerRac } from '@/components/ui/date-range-picker-rac';
import { cn } from '@/lib/utils';
import { useVehicleFinance } from '@/hooks/useStatistics';
import { useVehiclesList } from '@/hooks/useVehicles';
import type { VehicleFinanceDataPoint, VehicleFinanceFilters } from '@/types/statistics.types';
import type { Vehicle } from '@/types/vehicle.types';

// ── Colors & chart config ─────────────────────────────────────────────────────

const COLOR_CLIENT_PRICE = '#10b981';      // emerald-500 — revenue (from client)
const COLOR_TRANSPORTER_PRICE = '#f97316'; // orange-500 — cost (to transporter)
const COLOR_PROFIT = '#3b82f6';            // blue-500 — profit

const chartConfig = {
  clientPrice: { label: 'Client Price (Revenue)', color: COLOR_CLIENT_PRICE },
  transporterPrice: { label: 'Transporter Price (Cost)', color: COLOR_TRANSPORTER_PRICE },
  profit: { label: 'Profit', color: COLOR_PROFIT },
} satisfies ChartConfig;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateInput(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function fmtCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `€${(value / 1_000).toFixed(1)}k`;
  return `€${value.toFixed(0)}`;
}

function vehicleLabel(v: Vehicle): string {
  const brand = v.make ? ` · ${v.make}${v.model ? ` ${v.model}` : ''}` : '';
  return `${v.licensePlate}${brand}`;
}

// ── Vehicle multiselect ───────────────────────────────────────────────────────

interface VehicleMultiSelectProps {
  vehicles: Vehicle[];
  selected: number[];
  onChange: (ids: number[]) => void;
}

function VehicleMultiSelect({ vehicles, selected, onChange }: VehicleMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, Vehicle[]>();
    for (const v of vehicles) {
      const key = v.partner?.name ?? 'No Transporter';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [vehicles]);

  const allIds = vehicles.map((v) => v.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.includes(id));

  function toggleAll() {
    onChange(allSelected ? [] : allIds);
  }

  function toggle(id: number) {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  function removeChip(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    onChange(selected.filter((x) => x !== id));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'flex min-h-9 min-w-[180px] max-w-xs flex-wrap items-center gap-1 rounded-md border bg-background px-2 py-1 text-sm cursor-pointer hover:bg-muted/50 transition-colors',
          )}
        >
          {selected.length === 0 ? (
            <span className="text-muted-foreground px-1 text-sm">Vehicle</span>
          ) : (
            selected.map((id) => {
              const v = vehicles.find((x) => x.id === id);
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-0.5 rounded bg-primary text-primary-foreground px-1.5 py-0.5 text-xs font-medium"
                >
                  {v?.licensePlate ?? `#${id}`}
                  <span
                    role="button"
                    aria-label={`Remove ${v?.licensePlate ?? id}`}
                    className="ml-0.5 cursor-pointer hover:opacity-70"
                    onClick={(e) => removeChip(e, id)}
                  >
                    <X className="h-2.5 w-2.5" />
                  </span>
                </span>
              );
            })
          )}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {selected.length > 0 && (
              <span
                role="button"
                aria-label="Clear all vehicles"
                className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                onClick={(e) => { e.stopPropagation(); onChange([]); }}
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search vehicles..." />
          <CommandList>
            <CommandEmpty>No vehicles found.</CommandEmpty>
            {/* Select All row */}
            <CommandItem
              value="__select_all__"
              onSelect={toggleAll}
              className="cursor-pointer"
            >
              <Checkbox
                checked={allSelected}
                className="mr-2 h-4 w-4"
                aria-hidden
              />
              <span className="font-medium">Select All</span>
              {allSelected && <Check className="ml-auto h-4 w-4 text-primary" />}
            </CommandItem>
            {groups.map(([groupName, groupVehicles]) => (
              <CommandGroup key={groupName} heading={groupName}>
                {groupVehicles.map((v) => (
                  <CommandItem
                    key={v.id}
                    value={`${v.licensePlate} ${v.make ?? ''} ${v.model ?? ''}`}
                    onSelect={() => toggle(v.id)}
                    className="cursor-pointer"
                  >
                    <Checkbox
                      checked={selected.includes(v.id)}
                      className="mr-2 h-4 w-4"
                      aria-hidden
                    />
                    <span className="truncate">{vehicleLabel(v)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const entries = [
    { key: 'clientPrice', label: 'Client Price (Revenue)', color: COLOR_CLIENT_PRICE },
    { key: 'transporterPrice', label: 'Transporter Price (Cost)', color: COLOR_TRANSPORTER_PRICE },
    { key: 'profit', label: 'Profit', color: COLOR_PROFIT },
  ];

  const dataMap = Object.fromEntries(payload.map((p) => [p.name, p.value]));

  return (
    <div className="rounded-lg border bg-background p-2.5 shadow-sm text-xs min-w-[180px]">
      <p className="font-medium text-foreground mb-1.5">{label}</p>
      <div className="space-y-1">
        {entries.map(({ key, label: entryLabel, color }) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-muted-foreground">{entryLabel}</span>
            </div>
            <span className="font-medium text-foreground tabular-nums">
              {fmtCurrency(dataMap[key] ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Totals sidebar ────────────────────────────────────────────────────────────

interface TotalsSidebarProps {
  data: VehicleFinanceDataPoint[];
}

function TotalsSidebar({ data }: TotalsSidebarProps) {
  const totals = useMemo(
    () => ({
      transporterPrice: data.reduce((s, d) => s + d.transporterPrice, 0),
      clientPrice: data.reduce((s, d) => s + d.clientPrice, 0),
      profit: data.reduce((s, d) => s + d.profit, 0),
    }),
    [data],
  );

  const items = [
    { label: 'Client Price (Revenue):', value: totals.clientPrice, color: COLOR_CLIENT_PRICE },
    { label: 'Transporter Price (Cost):', value: totals.transporterPrice, color: COLOR_TRANSPORTER_PRICE },
    { label: 'Profit:', value: totals.profit, color: totals.profit >= 0 ? COLOR_PROFIT : '#ef4444' },
  ];

  return (
    <div className="text-sm">
      <p className="font-semibold text-foreground mb-3">Total reference values:</p>
      <div className="space-y-2">
        {items.map(({ label, value, color }) => (
          <p key={label}>
            <span className="font-semibold" style={{ color }}>{label}</span>{' '}
            <span className="text-foreground tabular-nums">{value.toFixed(2)}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function VehicleFinanceCard() {
  const [filters, setFilters] = useState<VehicleFinanceFilters>({
    startDate: toDateInput(subDays(new Date(), 30)),
    endDate: toDateInput(new Date()),
    vehicleIds: [],
  });

  const { data: financeData = [], isLoading } = useVehicleFinance(filters);
  const { data: vehiclesPage } = useVehiclesList(1, 500);
  const allVehicles = vehiclesPage?.items ?? [];

  const noVehiclesSelected = filters.vehicleIds.length === 0;

  function applyShortcut(days: number) {
    setFilters((f) => ({
      ...f,
      startDate: toDateInput(subDays(new Date(), days)),
      endDate: toDateInput(new Date()),
    }));
  }

  const xAxisInterval = financeData.length > 10 ? Math.floor(financeData.length / 6) : 0;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Finance
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {/* Date range picker */}
          <DateRangePickerRac
            startDate={filters.startDate}
            endDate={filters.endDate}
            onStartChange={(v) => setFilters((f) => ({ ...f, startDate: v }))}
            onEndChange={(v) => setFilters((f) => ({ ...f, endDate: v }))}
          />

          {/* Vehicle multiselect */}
          <VehicleMultiSelect
            vehicles={allVehicles}
            selected={filters.vehicleIds}
            onChange={(ids) => setFilters((f) => ({ ...f, vehicleIds: ids }))}
          />

          {/* Quick shortcuts — plain text */}
          <div className="ml-auto flex items-center gap-3">
            {[
              { label: '30 days', days: 30 },
              { label: '14 days', days: 14 },
              { label: '7 days', days: 7 },
            ].map(({ label, days }) => {
              const isActive = filters.startDate === toDateInput(subDays(new Date(), days));
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => applyShortcut(days)}
                  className={cn(
                    'text-sm cursor-pointer transition-colors',
                    isActive
                      ? 'font-semibold text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Chart + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Chart */}
          <div className="lg:col-span-3">
            {noVehiclesSelected ? (
              <div className="h-[280px] w-full flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground">
                <p className="text-sm font-medium">No vehicles selected</p>
                <p className="text-xs">Use the dropdown above to select one or more vehicles</p>
              </div>
            ) : isLoading ? (
              <div className="h-[280px] w-full rounded-lg bg-muted/50 animate-pulse" />
            ) : financeData.length === 0 ? (
              <div className="h-[280px] w-full flex items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
                No orders found for the selected vehicles and date range
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <AreaChart data={financeData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="vfGradTransporterPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLOR_TRANSPORTER_PRICE} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={COLOR_TRANSPORTER_PRICE} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="vfGradClientPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLOR_CLIENT_PRICE} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={COLOR_CLIENT_PRICE} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="vfGradProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLOR_PROFIT} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={COLOR_PROFIT} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeOpacity={0.35} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    interval={xAxisInterval}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v: number) => fmtCurrency(v)}
                    width={56}
                  />
                  <ChartTooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="transporterPrice"
                    name="transporterPrice"
                    stroke={COLOR_TRANSPORTER_PRICE}
                    strokeWidth={2}
                    fill="url(#vfGradTransporterPrice)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="clientPrice"
                    name="clientPrice"
                    stroke={COLOR_CLIENT_PRICE}
                    strokeWidth={2}
                    fill="url(#vfGradClientPrice)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    name="profit"
                    stroke={COLOR_PROFIT}
                    strokeWidth={2}
                    fill="url(#vfGradProfit)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ChartContainer>
            )}

            {/* Legend */}
            {!noVehiclesSelected && !isLoading && financeData.length > 0 && (
              <div className="flex items-center gap-4 mt-2 justify-center flex-wrap">
                {[
                  { color: COLOR_CLIENT_PRICE, label: 'Client Price (Revenue)' },
                  { color: COLOR_TRANSPORTER_PRICE, label: 'Transporter Price (Cost)' },
                  { color: COLOR_PROFIT, label: 'Profit' },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="h-2.5 w-5 rounded-sm opacity-80" style={{ background: color }} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar totals */}
          <div className="lg:col-span-1 flex items-start justify-start lg:justify-end pt-2">
            {!noVehiclesSelected && (
              isLoading ? (
                <div className="space-y-2">
                  <div className="h-4 w-36 rounded bg-muted/50 animate-pulse" />
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-4 w-28 rounded bg-muted/40 animate-pulse" />
                  ))}
                </div>
              ) : (
                <TotalsSidebar data={financeData} />
              )
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
