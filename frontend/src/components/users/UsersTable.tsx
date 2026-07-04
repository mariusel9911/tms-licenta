import { KeyRound, Lock, Pencil, Trash2 } from 'lucide-react';
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
import type { User, UserRole } from '@/types/user.types';

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  DISPATCHER: 'Dispatcher',
};

const ROLE_CLASSES: Record<UserRole, string> = {
  ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
  DISPATCHER: 'bg-blue-100 text-blue-800 border-blue-200',
};

interface UsersTableProps {
  data: User[];
  isLoading: boolean;
  isSystemAdmin?: boolean;
  onEdit: (user: User) => void;
  onResetPassword: (user: User) => void;
  onDelete: (user: User) => void;
}

export function UsersTable({
  data,
  isLoading,
  isSystemAdmin = false,
  onEdit,
  onResetPassword,
  onDelete,
}: UsersTableProps) {
  if (isLoading) {
    return <TableSkeleton rows={6} columns={['flex-1', 'flex-1', 'w-24', 'w-20', 'w-24']} />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title="No users found"
        description="Add your first user to get started."
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
            <TableHead className="px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-wide text-[#6b7280]">Name</TableHead>
            <TableHead className="px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-wide text-[#6b7280]">Email</TableHead>
            <TableHead className="px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-wide text-[#6b7280]">Role</TableHead>
            <TableHead className="px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-wide text-[#6b7280]">Status</TableHead>
            <TableHead className="px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-wide text-[#6b7280] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((user) => (
            <TableRow
              key={user.id}
              className="border-b border-[#f3f4f6] last:border-0 hover:bg-[#f9fafb] transition-colors duration-150"
            >
              <TableCell className="px-4 py-[14px] font-medium text-[#111827]">
                {user.name}
              </TableCell>
              <TableCell className="px-4 py-[14px] text-sm text-[#4b5563]">
                {user.email}
              </TableCell>
              <TableCell className="px-4 py-[14px]">
                <Badge
                  variant="outline"
                  className={`text-xs font-medium ${ROLE_CLASSES[user.role]}`}
                >
                  {ROLE_LABELS[user.role]}
                </Badge>
              </TableCell>
              <TableCell className="px-4 py-[14px]">
                <Badge
                  variant="outline"
                  className={
                    user.isActive
                      ? 'text-xs font-medium bg-green-100 text-green-800 border-green-200'
                      : 'text-xs font-medium bg-gray-100 text-gray-600 border-gray-200'
                  }
                >
                  {user.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell className="px-4 py-[14px] text-right">
                {user.isSystemAdmin ? (
                  <div className="flex justify-end items-center gap-1 text-gray-400" title="Cannot be modified">
                    <Lock className="h-4 w-4" />
                    <span className="text-xs">System</span>
                  </div>
                ) : (
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(user)}
                      title="Edit user"
                      className="active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onResetPassword(user)}
                      title="Reset password"
                      className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(user)}
                      title={isSystemAdmin ? 'Permanently delete user' : 'Deactivate user'}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}