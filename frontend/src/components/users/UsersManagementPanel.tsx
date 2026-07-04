import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/store/auth.store';
import { useUsersList, useDeleteUser } from '@/hooks/useUsers';
import { UsersTable } from './UsersTable';
import { UserFormModal } from './UserFormModal';
import { ResetPasswordModal } from './ResetPasswordModal';
import type { User } from '@/types/user.types';

export function UsersManagementPanel() {
  const { toast } = useToast();
  const authUser = useAuthStore((s) => s.user);
  const isSystemAdmin = authUser?.isSystemAdmin === true;

  const { data, isLoading } = useUsersList(1, 100);
  const deleteMutation = useDeleteUser();

  const [formOpen, setFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const users = data?.items ?? [];

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setFormOpen(true);
  };

  const handleNew = () => {
    setSelectedUser(null);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setSelectedUser(null);
  };

  const handleResetPasswordClose = () => {
    setResetPasswordUser(null);
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget === null) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast({
          title: isSystemAdmin ? 'User deleted permanently' : 'User deactivated successfully',
        });
        setDeleteTarget(null);
      },
      onError: (err) => {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          (isSystemAdmin ? 'Failed to delete user' : 'Failed to deactivate user');
        toast({ title: 'Error', description: msg, variant: 'destructive' });
        setDeleteTarget(null);
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">Users</h2>
        <Button
          onClick={handleNew}
          className="bg-green-600 hover:bg-green-700 text-white active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          New User
        </Button>
      </div>

      <UsersTable
        data={users}
        isLoading={isLoading}
        isSystemAdmin={isSystemAdmin}
        onEdit={handleEdit}
        onResetPassword={setResetPasswordUser}
        onDelete={(user) => setDeleteTarget({ id: user.id, name: user.name })}
      />

      <UserFormModal
        open={formOpen}
        onClose={handleFormClose}
        user={selectedUser}
      />

      <ResetPasswordModal
        open={resetPasswordUser !== null}
        onClose={handleResetPasswordClose}
        user={resetPasswordUser}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={isSystemAdmin ? 'Permanently Delete User' : 'Deactivate User'}
        description={
          isSystemAdmin
            ? `This will permanently remove "${deleteTarget?.name}" from the system. Their orders will be preserved but unattributed. This action cannot be undone.`
            : 'This will deactivate the user account. They will no longer be able to log in. You can reactivate them later by editing the account.'
        }
        confirmLabel={isSystemAdmin ? 'Delete Permanently' : 'Deactivate'}
        pendingLabel={isSystemAdmin ? 'Deleting…' : 'Deactivating…'}
        isDestructive
        isPending={deleteMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}