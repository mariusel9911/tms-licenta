import { useEffect, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  Download,
  FilePen,
  ListFilter,
  PackageCheck,
  Search,
  Settings2,
  Truck,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { OrderFilters as OrderFiltersType } from '@/types/order.types';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Statuses', icon: ListFilter, bg: 'bg-gray-100', text: 'text-gray-600', hover: 'hover:bg-gray-200' },
  { value: 'DRAFT', label: 'Draft', icon: FilePen, bg: 'bg-gray-100', text: 'text-gray-700', hover: 'hover:bg-gray-200' },
  { value: 'CONFIRMED', label: 'Confirmed', icon: CheckCircle2, bg: 'bg-blue-50', text: 'text-blue-600', hover: 'hover:bg-blue-100' },
  { value: 'IN_PROGRESS', label: 'In Progress', icon: Truck, bg: 'bg-amber-50', text: 'text-amber-600', hover: 'hover:bg-amber-100' },
  { value: 'COMPLETED', label: 'Delivered', icon: PackageCheck, bg: 'bg-emerald-50', text: 'text-emerald-600', hover: 'hover:bg-emerald-100' },
  { value: 'CANCELLED', label: 'Cancelled', icon: XCircle, bg: 'bg-red-50', text: 'text-red-500', hover: 'hover:bg-red-100' },
] as const;

interface OrderFiltersProps {
  filters: OrderFiltersType;
  onFiltersChange: (filters: OrderFiltersType) => void;
  onNewOrder: () => void;
  onExport: () => void;
  onOpenTableSettings: () => void;
  onLoadArchive: (dateFrom: string, dateTo: string) => void;
}

export function OrderFilters({
  filters,
  onFiltersChange,
  onNewOrder,
  onExport,
  onOpenTableSettings,
  onLoadArchive,
}: OrderFiltersProps) {
  const [inputValue, setInputValue] = useState(filters.search ?? '');
  const [statusOpen, setStatusOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveFrom, setArchiveFrom] = useState('');
  const [archiveTo, setArchiveTo] = useState('');

  useEffect(() => {
    setInputValue(filters.search ?? '');
  }, [filters.search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onFiltersChange({ ...filters, search: inputValue || undefined });
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue]);

  const handleStatus = (value: string) => {
    setStatusOpen(false);
    onFiltersChange({
      ...filters,
      status: value === 'ALL' ? undefined : (value as OrderFiltersType['status']),
      archived: false,
    });
  };

  const handleDateFrom = (value: string) => {
    onFiltersChange({ ...filters, dateFrom: value || undefined });
  };

  const handleDateTo = (value: string) => {
    onFiltersChange({ ...filters, dateTo: value || undefined });
  };

  const handleOpenArchiveDialog = () => {
    setArchiveFrom('');
    setArchiveTo('');
    setArchiveOpen(true);
  };

  const handleLoadArchive = () => {
    if (!archiveFrom || !archiveTo) return;
    onLoadArchive(archiveFrom, archiveTo);
    setArchiveOpen(false);
  };

  const currentStatus = STATUS_OPTIONS.find(
    (s) => s.value === (filters.status ?? 'ALL'),
  ) ?? STATUS_OPTIONS[0];

  const CurrentIcon = currentStatus.icon;

  return (
    <>
      <div className="space-y-3">
        {/* Top action buttons row */}
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <Button
            variant="default"
            className="bg-green-500 hover:bg-green-600 text-white gap-2 transition-[transform,colors]"
            onClick={onExport}
          >
            <Download className="h-4 w-4" />
            EXPORT
          </Button>
          <Button
            variant="outline"
            onClick={handleOpenArchiveDialog}
            className="border-orange-400 text-orange-500 hover:bg-orange-50 gap-2 transition-[transform,colors]"
          >
            <Archive className="h-4 w-4" />
            ARCHIVED ORDERS
          </Button>
          <Button variant="outline" className="gap-2 text-gray-600 transition-[transform,colors]" onClick={onOpenTableSettings}>
            <Settings2 className="h-4 w-4" />
            TABLE SETTINGS
          </Button>
        </div>

        {/* Search + filter row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative min-w-[240px] max-w-md w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search orders..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="pl-9 h-10 bg-gray-50 border-gray-300 rounded-lg text-sm placeholder:text-gray-400 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-ring transition-[border-color,background-color,box-shadow] duration-200"
            />
          </div>

          {/* Status filter — fixed-width, input-style trigger */}
          <Popover open={statusOpen} onOpenChange={setStatusOpen}>
            <PopoverTrigger asChild>
              <button
                className="inline-flex items-center gap-2 w-[180px] h-10 px-3 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium cursor-pointer transition-[border-color,background-color,box-shadow] duration-200 hover:bg-gray-100 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-ring"
              >
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full shrink-0 ${currentStatus.bg}`}>
                  <CurrentIcon className={`h-3.5 w-3.5 ${currentStatus.text}`} strokeWidth={2.5} />
                </span>
                <span className={`truncate ${currentStatus.text}`}>{currentStatus.label}</span>
                <ChevronDown className={cn('h-3.5 w-3.5 text-gray-400 ml-auto shrink-0 transition-transform duration-200 ease-out-expo', statusOpen && 'rotate-180')} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1.5" align="start" side="bottom">
              <div className="flex flex-col">
                {STATUS_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isActive = opt.value === (filters.status ?? 'ALL');
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleStatus(opt.value)}
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

          <DatePicker
            value={filters.dateFrom}
            onChange={handleDateFrom}
            placeholder="From date"
          />
          <DatePicker
            value={filters.dateTo}
            onChange={handleDateTo}
            placeholder="To date"
          />

          <div className="flex-1" />

          <Button
            onClick={onNewOrder}
            className="bg-green-600 hover:bg-green-700 text-white gap-2 rounded-lg transition-[transform,colors]"
          >
            + New Order
          </Button>
        </div>
      </div>

      {/* Archive date range dialog */}
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Load Archived Orders</DialogTitle>
            <DialogDescription>
              Select a document date range to browse archived orders (auto-archived after 3 months).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex items-center gap-3">
              <span className="w-12 text-sm text-muted-foreground shrink-0">From</span>
              <DatePicker
                value={archiveFrom}
                onChange={setArchiveFrom}
                placeholder="Start date"
                className="flex-1 w-auto"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="w-12 text-sm text-muted-foreground shrink-0">To</span>
              <DatePicker
                value={archiveTo}
                onChange={setArchiveTo}
                placeholder="End date"
                className="flex-1 w-auto"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setArchiveOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleLoadArchive}
              disabled={!archiveFrom || !archiveTo}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Archive className="h-4 w-4 mr-2" />
              Load Archive
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
