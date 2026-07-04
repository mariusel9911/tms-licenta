import { useEffect, useState } from 'react';
import {
  ChevronDown,
  CircleCheck,
  CircleDashed,
  ListFilter,
  Plus,
  Search,
  Truck,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { VehiclesTable } from '@/components/vehicles/VehiclesTable';
import { VehicleForm } from '@/components/vehicles/VehicleForm';
import { useVehiclesList, useDeleteVehicle } from '@/hooks/useVehicles';
import { useToast } from '@/hooks/use-toast';
import type { Vehicle, VehicleStatus } from '@/types/vehicle.types';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const VEHICLE_STATUS_OPTIONS = [
  { value: '', label: 'All Statuses', icon: ListFilter, bg: 'bg-gray-100', text: 'text-gray-600', hover: 'hover:bg-gray-200' },
  { value: 'AVAILABLE', label: 'Available', icon: CircleCheck, bg: 'bg-emerald-50', text: 'text-emerald-600', hover: 'hover:bg-emerald-100' },
  { value: 'ON_ROUTE', label: 'On Route', icon: CircleDashed, bg: 'bg-blue-50', text: 'text-blue-600', hover: 'hover:bg-blue-100' },
  { value: 'MAINTENANCE', label: 'Maintenance', icon: Wrench, bg: 'bg-amber-50', text: 'text-amber-600', hover: 'hover:bg-amber-100' },
  { value: 'INACTIVE', label: 'Inactive', icon: XCircle, bg: 'bg-gray-100', text: 'text-gray-500', hover: 'hover:bg-gray-200' },
] as const;

export default function VehiclesPage() {
  useEffect(() => { document.title = 'Vehicles'; }, []);
  const { toast } = useToast();

  // View state
  const [view, setView] = useState<'list' | 'form'>('list');
  const [formVehicle, setFormVehicle] = useState<Vehicle | null>(null); // null = add mode

  // Pagination & filter state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | ''>('');
  const [statusOpen, setStatusOpen] = useState(false);

  // Delete dialog state
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading } = useVehiclesList(
    page,
    limit,
    search || undefined,
    statusFilter || undefined,
  );
  const deleteVehicle = useDeleteVehicle();

  const openForm = (vehicle: Vehicle | null) => {
    setFormVehicle(vehicle);
    setView('form');
  };

  const closeForm = () => {
    setView('list');
    setFormVehicle(null);
  };

  // Debounce search: propagate to query after 200ms of no typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteVehicle.mutateAsync(deleteId);
      toast({ title: 'Vehicle deleted successfully' });
    } catch {
      toast({ title: 'Failed to delete vehicle', variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(page * limit, total);

  return (
    <div className="space-y-0">
      {/* ─── Tab bar ─── */}
      <div className="flex border-b bg-white -mx-6 -mt-6 mb-4 px-2">
        {/* Tab 1: Vehicles list */}
        <button
          onClick={closeForm}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm border-r transition-colors
            ${view === 'list'
              ? 'bg-white font-medium text-gray-900 border-b-2 border-b-blue-600 -mb-px'
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
        >
          <Truck className="h-4 w-4" />
          Vehicles
        </button>

        {/* Tab 2: Form tab — only visible when form is open */}
        {view === 'form' && (
          <div className="flex items-center gap-1 px-4 py-2.5 text-sm bg-white font-medium border-r border-b-2 border-b-blue-600 -mb-px">
            <Plus className="h-3 w-3" />
            <span>{formVehicle ? formVehicle.licensePlate : 'Add vehicle'}</span>
            <button
              onClick={closeForm}
              className="ml-2 text-gray-400 hover:text-gray-700 rounded"
              title="Close tab"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ─── List view ─── */}
      {view === 'list' && (
        <div className="space-y-4 animate-in fade-in-0 duration-200">
          {/* Top bar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 flex gap-2">
              <div className="relative max-w-md w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search vehicles..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9 h-10 bg-gray-50 border-gray-300 rounded-lg text-sm placeholder:text-gray-400 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-ring transition-[border-color,background-color,box-shadow] duration-200"
                />
              </div>
              {searchInput && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchInput('');
                    setSearch('');
                    setPage(1);
                  }}
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Status filter — fixed-width, input-style trigger */}
            <Popover open={statusOpen} onOpenChange={setStatusOpen}>
              <PopoverTrigger asChild>
                {(() => {
                  const current = VEHICLE_STATUS_OPTIONS.find((s) => s.value === statusFilter) ?? VEHICLE_STATUS_OPTIONS[0];
                  const Icon = current.icon;
                  return (
                    <button
                      className="inline-flex items-center gap-2 w-[180px] h-10 px-3 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium cursor-pointer transition-[border-color,background-color,box-shadow] duration-200 hover:bg-gray-100 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full shrink-0 ${current.bg}`}>
                        <Icon className={`h-3.5 w-3.5 ${current.text}`} strokeWidth={2.5} />
                      </span>
                      <span className={`truncate ${current.text}`}>{current.label}</span>
                      <ChevronDown className={`h-3.5 w-3.5 text-gray-400 ml-auto shrink-0 transition-transform duration-200 ease-out-expo${statusOpen ? ' rotate-180' : ''}`} />
                    </button>
                  );
                })()}
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1.5" align="start" side="bottom" style={{ transformOrigin: 'var(--radix-popover-content-transform-origin)' }}>
                <div className="flex flex-col">
                  {VEHICLE_STATUS_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isActive = opt.value === statusFilter;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setStatusFilter(opt.value as VehicleStatus | '');
                          setPage(1);
                          setStatusOpen(false);
                        }}
                        className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-100 cursor-pointer hover:bg-gray-100 ${isActive ? 'font-semibold bg-gray-50' : 'font-medium text-gray-700'}`}
                      >
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${opt.bg}`}>
                          <Icon className={`h-3.5 w-3.5 ${opt.text}`} strokeWidth={2.5} />
                        </span>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            <Button
              onClick={() => openForm(null)}
              className="bg-green-600 hover:bg-green-700 text-white gap-2 rounded-lg"
            >
              <Plus className="h-4 w-4" />
              Add Vehicle
            </Button>
          </div>

          {/* Table */}
          <VehiclesTable
            data={items}
            isLoading={isLoading}
            onEdit={(vehicle) => openForm(vehicle)}
            onDelete={(id) => setDeleteId(id)}
          />

          {/* Pagination */}
          {!isLoading && total > 0 && (
            <div className="flex items-center justify-end gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Items per page:</span>
                <Select
                  value={String(limit)}
                  onValueChange={(val) => {
                    setLimit(Number(val));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-16 bg-background text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <span>
                {rangeStart} – {rangeEnd} of {total}
              </span>

              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  title="First page"
                >
                  «
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  title="Previous page"
                >
                  ‹
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  title="Next page"
                >
                  ›
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                  title="Last page"
                >
                  »
                </Button>
              </div>
            </div>
          )}

          {/* Delete confirmation */}
          <ConfirmDialog
            open={deleteId !== null}
            title="Delete Vehicle"
            description="Are you sure you want to delete this vehicle? This action cannot be undone."
            confirmLabel="Delete"
            isDestructive
            onConfirm={handleDelete}
            onCancel={() => setDeleteId(null)}
          />
        </div>
      )}

      {/* ─── Form view ─── */}
      {view === 'form' && (
        <div className="animate-in fade-in-0 duration-200">
          <VehicleForm
            vehicle={formVehicle ?? undefined}
            onClose={closeForm}
          />
        </div>
      )}
    </div>
  );
}
