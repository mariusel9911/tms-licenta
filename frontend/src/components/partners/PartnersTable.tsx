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
import { TableSkeleton } from '@/components/common/TableSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { useAuthStore } from '@/store/auth.store';
import type { Partner } from '@/types/partner.types';

interface PartnersTableProps {
  data: Partner[];
  isLoading: boolean;
  onEdit: (partner: Partner) => void;
  onDelete: (id: number) => void;
}

export function PartnersTable({
  data,
  isLoading,
  onEdit,
  onDelete,
}: PartnersTableProps) {
  const user = useAuthStore((s) => s.user);

  if (isLoading) {
    return <TableSkeleton rows={6} columns={['flex-1', 'w-48', 'w-32', 'flex-1', 'w-32', 'w-20']} />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title="No partners found"
        description="Add your first partner to get started."
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
            <TableHead className="px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-wide text-[#6b7280]">Partner name</TableHead>
            <TableHead className="px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-wide text-[#6b7280]">Email</TableHead>
            <TableHead className="px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-wide text-[#6b7280]">Phone</TableHead>
            <TableHead className="px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-wide text-[#6b7280]">Address</TableHead>
            <TableHead className="px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-wide text-[#6b7280]">Fiscal code</TableHead>
            <TableHead className="px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-wide text-[#6b7280] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((partner) => (
            <TableRow
              key={partner.id}
              className="border-b border-[#f3f4f6] last:border-0 hover:bg-[#f9fafb] transition-colors duration-150"
            >
              <TableCell className="px-4 py-[14px] font-medium text-[#111827]">
                {partner.name}
              </TableCell>
              <TableCell className="px-4 py-[14px] text-sm text-[#4b5563]">
                {partner.email ?? '—'}
              </TableCell>
              <TableCell className="px-4 py-[14px] text-sm text-[#4b5563]">
                {partner.phone ?? '—'}
              </TableCell>
              <TableCell className="px-4 py-[14px] text-sm text-[#4b5563] max-w-xs truncate">
                {[partner.addressLine1, partner.city].filter(Boolean).join(', ') || '—'}
              </TableCell>
              <TableCell className="px-4 py-[14px] text-sm text-[#4b5563]">
                {partner.fiscalCode ?? '—'}
              </TableCell>
              <TableCell className="px-4 py-[14px] text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(partner)}
                    title="Edit partner"
                    className="transition-[transform,colors] duration-100 hover:bg-blue-50 hover:text-blue-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {user?.role === 'ADMIN' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(partner.id)}
                      title="Delete partner"
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
