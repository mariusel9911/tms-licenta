import { useState } from 'react';
import { KeyRound, Trash2, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { usePasskeys, useRemovePasskey, useRenamePasskey } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function PasskeysList() {
  const { toast } = useToast();
  const { data: passkeys = [], isLoading } = usePasskeys();
  const removePasskey = useRemovePasskey();
  const renamePasskey = useRenamePasskey();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleStartEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditValue(currentName);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleSaveEdit = (id: string) => {
    const name = editValue.trim();
    if (!name) return;
    renamePasskey.mutate(
      { id, deviceName: name },
      {
        onSuccess: () => {
          setEditingId(null);
          setEditValue('');
          toast({ title: 'Passkey renamed' });
        },
        onError: () => {
          toast({ title: 'Error', description: 'Failed to rename passkey.', variant: 'destructive' });
        },
      },
    );
  };

  const handleDelete = () => {
    if (!deleteId) return;
    removePasskey.mutate(deleteId, {
      onSuccess: () => {
        setDeleteId(null);
        toast({ title: 'Passkey removed' });
      },
      onError: () => {
        toast({ title: 'Error', description: 'Failed to remove passkey.', variant: 'destructive' });
        setDeleteId(null);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-md animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {passkeys.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">No passkeys registered yet.</p>
        ) : (
          passkeys.map((pk) => (
            <div
              key={pk.id}
              className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2.5 hover:border-gray-300 transition-colors duration-150"
            >
              {/* Icon + name/edit */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100">
                  <KeyRound className="w-3.5 h-3.5 text-gray-600" />
                </div>
                {editingId === pk.id ? (
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(pk.id);
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    className="h-7 text-sm py-0 px-2 w-40"
                    maxLength={100}
                    autoFocus
                  />
                ) : (
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{pk.deviceName}</p>
                    <p className="text-xs text-gray-400">Added {formatDate(pk.createdAt)}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {editingId === pk.id ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
                      onClick={() => handleSaveEdit(pk.id)}
                      disabled={renamePasskey.isPending}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-gray-500 hover:text-gray-700 active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
                      onClick={handleCancelEdit}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-gray-400 hover:text-gray-700 active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
                      onClick={() => handleStartEdit(pk.id, pk.deviceName)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50 active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
                      onClick={() => setDeleteId(pk.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Remove Passkey"
        description="This passkey will be permanently removed. You won't be able to use it to sign in anymore."
        confirmLabel="Remove"
        pendingLabel="Removing…"
        isDestructive
        isPending={removePasskey.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
