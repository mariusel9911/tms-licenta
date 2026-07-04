import { useEffect, useState } from 'react';
import { Search, UserPlus, Users, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { PartnersTable } from '@/components/partners/PartnersTable';
import { PartnerForm } from '@/components/partners/PartnerForm';
import { usePartnersList, useDeletePartner } from '@/hooks/usePartners';
import { useToast } from '@/hooks/use-toast';
import type { Partner } from '@/types/partner.types';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function PartnersPage() {
  useEffect(() => { document.title = 'Partners'; }, []);
  const { toast } = useToast();

  // View state
  const [view, setView] = useState<'list' | 'form'>('list');
  const [formPartner, setFormPartner] = useState<Partner | null>(null); // null = add mode

  // Pagination & filter state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Delete dialog state
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading } = usePartnersList(page, limit, search || undefined);
  const deletePartner = useDeletePartner();

  const openForm = (partner: Partner | null) => {
    setFormPartner(partner);
    setView('form');
  };

  const closeForm = () => {
    setView('list');
    setFormPartner(null);
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
      await deletePartner.mutateAsync(deleteId);
      toast({ title: 'Partner deleted successfully' });
    } catch {
      toast({ title: 'Failed to delete partner', variant: 'destructive' });
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
        {/* Tab 1: Partners list */}
        <button
          onClick={closeForm}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm border-r transition-colors
            ${view === 'list'
              ? 'bg-white font-medium text-gray-900 border-b-2 border-b-blue-600 -mb-px'
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
        >
          <Users className="h-4 w-4" />
          Partner
        </button>

        {/* Tab 2: Form tab — only visible when form is open */}
        {view === 'form' && (
          <div className="flex items-center gap-1 px-4 py-2.5 text-sm bg-white font-medium border-r border-b-2 border-b-blue-600 -mb-px">
            <Plus className="h-3 w-3" />
            <span>{formPartner ? formPartner.name : 'Add partner'}</span>
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
                  placeholder="Search partners..."
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

            <Button
              onClick={() => openForm(null)}
              className="bg-green-600 hover:bg-green-700 text-white gap-2 rounded-lg"
            >
              <UserPlus className="h-4 w-4" />
              Add Partner
            </Button>
          </div>

          {/* Table */}
          <PartnersTable
            data={items}
            isLoading={isLoading}
            onEdit={(partner) => openForm(partner)}
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
            title="Delete Partner"
            description="Are you sure you want to delete this partner? This action cannot be undone."
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
          <PartnerForm
            partner={formPartner ?? undefined}
            onClose={closeForm}
          />
        </div>
      )}
    </div>
  );
}
