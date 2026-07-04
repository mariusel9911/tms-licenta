import { Pencil, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableSkeleton } from '@/components/common/TableSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { useAuthStore } from '@/store/auth.store';
import type { Vehicle, VehicleStatus } from '@/types/vehicle.types';

const STATUS_LABELS: Record<VehicleStatus, string> = {
  AVAILABLE: 'Available',
  ON_ROUTE: 'On Route',
  MAINTENANCE: 'Maintenance',
  INACTIVE: 'Inactive',
};

const STATUS_CLASSES: Record<VehicleStatus, string> = {
  AVAILABLE: 'bg-green-100 text-green-800 border-green-200',
  ON_ROUTE: 'bg-blue-100 text-blue-800 border-blue-200',
  MAINTENANCE: 'bg-amber-100 text-amber-800 border-amber-200',
  INACTIVE: 'bg-gray-100 text-gray-600 border-gray-200',
};

interface VehiclesTableProps {
  data: Vehicle[];
  isLoading: boolean;
  onEdit: (vehicle: Vehicle) => void;
  onDelete: (id: number) => void;
}

export function VehiclesTable({
  data,
  isLoading,
  onEdit,
  onDelete,
}: VehiclesTableProps) {
  const user = useAuthStore((s) => s.user);

  if (isLoading) {
    return <TableSkeleton rows={6} columns={['w-32', 'flex-1', 'w-24', 'flex-1', 'w-16', 'w-20']} />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title="No vehicles found"
        description="Add your first vehicle to get started."
      />
    );
  }

  return (
    <div
      className="rounded-xl overflow-x-auto bg-white"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08)' }}
    >
      <Table>
        <TableHeader className="bg-[#fafafa] border-b border-[#e5e7eb]">
          <TableRow className="border-0 hover:bg-transparent">
            <TableHead className="px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-wide text-[#6b7280]">License Plate</TableHead>
            <TableHead className="px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-wide text-[#6b7280]">Make & Model</TableHead>
            <TableHead className="px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-wide text-[#6b7280]">Status</TableHead>
            <TableHead className="px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-wide text-[#6b7280]">Partner</TableHead>
            <TableHead className="px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-wide text-[#6b7280]">Year</TableHead>
            <TableHead className="px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-wide text-[#6b7280] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((vehicle) => (
            <TableRow
              key={vehicle.id}
              className="border-b border-[#f3f4f6] last:border-0 hover:bg-[#f9fafb] transition-colors duration-150"
            >
              <TableCell className="px-4 py-[14px] font-medium text-[#111827]">
                {vehicle.licensePlate}
              </TableCell>
              <TableCell className="px-4 py-[14px] text-sm text-[#4b5563]">
                {[vehicle.make, vehicle.model].filter(Boolean).join(' ') || '—'}
              </TableCell>
              <TableCell className="px-4 py-[14px]">
                <Badge
                  variant="outline"
                  className={`text-xs font-medium ${STATUS_CLASSES[vehicle.status]}`}
                >
                  {STATUS_LABELS[vehicle.status]}
                </Badge>
              </TableCell>
              <TableCell className="px-4 py-[14px] text-sm text-[#4b5563]">
                {vehicle.partner?.name ?? '—'}
              </TableCell>
              <TableCell className="px-4 py-[14px] text-sm text-[#4b5563]">
                {vehicle.yearOfManufacture ?? '—'}
              </TableCell>
              <TableCell className="px-4 py-[14px] text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(vehicle)}
                    title="Edit vehicle"
                    className="transition-[transform,colors] duration-100 hover:bg-blue-50 hover:text-blue-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {user?.role === 'ADMIN' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(vehicle.id)}
                      title="Delete vehicle"
                      className="transition-[transform,colors] duration-100 text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
