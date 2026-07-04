import { useRef, useState } from 'react';
import {
  Activity, Download,
  FileText, FolderOpen, Info, ScrollText, Shield, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import { useAuditFiles, useAuditEntries, useDownloadAuditLog } from '@/hooks/useAuditLog';
import { useToast } from '@/hooks/use-toast';
import type { AuditCategory, AuditSeverity, AuditEntry } from '@/types/audit.types';

// ─── Toggle row ───────────────────────────────────────────────────────────────

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
}

function ToggleRow({ label, description, checked, disabled, onToggle, icon }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">{icon}{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          checked ? 'bg-green-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function severityBadge(severity: AuditSeverity) {
  if (severity === 'ERROR') return <span className="inline-flex items-center rounded border px-2 py-0.5 bg-red-100 text-red-700 border-red-200 font-mono text-[10px] font-semibold pointer-events-none select-none">ERROR</span>;
  if (severity === 'WARN')  return <span className="inline-flex items-center rounded border px-2 py-0.5 bg-amber-100 text-amber-700 border-amber-200 font-mono text-[10px] font-semibold pointer-events-none select-none">WARN</span>;
  return <span className="inline-flex items-center rounded border px-2 py-0.5 bg-blue-50 text-blue-600 border-blue-100 font-mono text-[10px] font-semibold pointer-events-none select-none">INFO</span>;
}

function categoryIcon(category: AuditCategory) {
  if (category === 'BACKUP')    return <FileText   className="h-3.5 w-3.5 text-gray-400" />;
  if (category === 'AUTH')      return <Shield     className="h-3.5 w-3.5 text-gray-400" />;
  if (category === 'USER_MANAGEMENT') return <Activity   className="h-3.5 w-3.5 text-gray-400" />;
  return <Info className="h-3.5 w-3.5 text-gray-400" />;
}

function formatTs(ts: string): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ─── Detail dialog ────────────────────────────────────────────────────────────

function EntryDetailDialog({ entry, onClose }: { entry: AuditEntry | null; onClose: () => void }) {
  return (
    <Dialog open={!!entry} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {entry && categoryIcon(entry.category)}
            <span className="font-mono text-sm">{entry?.action}</span>
          </DialogTitle>
        </DialogHeader>
        {entry && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600">
              <span className="text-gray-400">Time</span>
              <span>{formatTs(entry.timestamp)}</span>
              <span className="text-gray-400">Category</span>
              <span>{entry.category}</span>
              <span className="text-gray-400">Severity</span>
              <span>{severityBadge(entry.severity)}</span>
              <span className="text-gray-400">Actor</span>
              <span>{entry.actor?.email ?? entry.actor?.userId ?? '—'}</span>
            </div>
            <div>
              <p className="text-gray-400 text-xs mb-1">Details</p>
              <pre className="bg-gray-50 rounded p-3 text-xs overflow-auto max-h-48 whitespace-pre-wrap break-all">
                {JSON.stringify(entry.details, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Audit log toggles card ───────────────────────────────────────────────────

function AuditTogglesCard() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();

  const toggle = (field: string, current: boolean) => {
    updateMutation.mutate(
      { [field]: !current } as Parameters<typeof updateMutation.mutate>[0],
      {
        onSuccess: () => toast({ title: `Audit ${!current ? 'enabled' : 'disabled'}` }),
        onError:   () => toast({ title: 'Failed to update setting', variant: 'destructive' }),
      },
    );
  };

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  const s = settings!;
  const busy = updateMutation.isPending;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-700">Audit categories</p>
      <ToggleRow
        label="Backup events"
        description="Create, delete, restore, S3 upload, retention prune"
        icon={<FileText className="h-3.5 w-3.5 text-gray-400" />}
        checked={s.auditBackupEnabled ?? true}
        disabled={busy}
        onToggle={() => toggle('auditBackupEnabled', s.auditBackupEnabled ?? true)}
      />
      <ToggleRow
        label="Auth events"
        description="Failed logins, lockouts, passkey & TOTP changes"
        icon={<Shield className="h-3.5 w-3.5 text-gray-400" />}
        checked={s.auditAuthEnabled ?? true}
        disabled={busy}
        onToggle={() => toggle('auditAuthEnabled', s.auditAuthEnabled ?? true)}
      />
      <ToggleRow
        label="User management"
        description="User create, deactivate, delete, role changes, password resets"
        icon={<Activity className="h-3.5 w-3.5 text-gray-400" />}
        checked={s.auditUserMgmtEnabled ?? true}
        disabled={busy}
        onToggle={() => toggle('auditUserMgmtEnabled', s.auditUserMgmtEnabled ?? true)}
      />
      <ToggleRow
        label="Settings changes"
        description="AppSettings mutations (toggle changes always logged)"
        icon={<Info className="h-3.5 w-3.5 text-gray-400" />}
        checked={s.auditSettingsEnabled ?? true}
        disabled={busy}
        onToggle={() => toggle('auditSettingsEnabled', s.auditSettingsEnabled ?? true)}
      />
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 500;

function parseJsonlEntries(text: string): { entries: AuditEntry[]; errors: number } {
  let errors = 0;
  const entries: AuditEntry[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as AuditEntry);
    } catch {
      errors++;
    }
  }
  return { entries, errors };
}

export function SystemLogsPanel() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [category,    setCategory]    = useState<AuditCategory | ''>('');
  const [severity,    setSeverity]    = useState<AuditSeverity | ''>('');
  const [q,           setQ]           = useState('');
  const [detailEntry, setDetailEntry] = useState<AuditEntry | null>(null);

  // Debounced search values
  const [debouncedQ, setDebouncedQ] = useState('');
  const qTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local file view
  const [localEntries,  setLocalEntries]  = useState<AuditEntry[] | null>(null);
  const [localFilename, setLocalFilename] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadMutation = useDownloadAuditLog();

  const { data: files, isLoading: filesLoading } = useAuditFiles();

  const today = new Date().toISOString().slice(0, 10);
  const activeDate = selectedDate || today;

  const { data: entriesData, isLoading: entriesLoading } = useAuditEntries({
    date:     activeDate,
    category: category   || undefined,
    severity: severity   || undefined,
    q:        debouncedQ || undefined,
    page:     1,
    pageSize: PAGE_SIZE,
  });

  // When viewing a local file, filter client-side
  const localFiltered = localEntries
    ? localEntries
        .filter((e) => !category   || e.category === category)
        .filter((e) => !severity   || e.severity === severity)
        .filter((e) => !debouncedQ || JSON.stringify(e).toLowerCase().includes(debouncedQ.toLowerCase()))
    : null;

  const displayEntries = localFiltered ?? entriesData?.entries ?? [];
  const totalCount     = localFiltered ? localFiltered.length : (entriesData?.total ?? 0);

  const handleQChange = (value: string) => {
    setQ(value);
    if (qTimer.current) clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => setDebouncedQ(value), 250);
  };

  const handleDownload = async () => {
    try {
      await downloadMutation.mutateAsync(activeDate);
    } catch {
      toast({ title: 'Download failed', variant: 'destructive' });
    }
  };

  const handleLoadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      let text: string;

      if (file.name.endsWith('.gz')) {
        const buffer = await file.arrayBuffer();
        const ds     = new DecompressionStream('gzip');
        const writer = ds.writable.getWriter();
        writer.write(buffer);
        writer.close();
        const chunks: Uint8Array[] = [];
        const reader = ds.readable.getReader();
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const total = chunks.reduce((n, c) => n + c.length, 0);
        const merged = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
        text = new TextDecoder().decode(merged);
      } else {
        text = await file.text();
      }

      const { entries, errors } = parseJsonlEntries(text);
      if (entries.length === 0) {
        toast({ title: 'No valid entries found in file', variant: 'destructive' });
        return;
      }
      entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setLocalEntries(entries);
      setLocalFilename(file.name);
      if (errors > 0) {
        toast({ title: `Loaded ${entries.length} entries — ${errors} malformed lines skipped`, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Could not read file — corrupted or unsupported format', variant: 'destructive' });
    }
  };

  const clearLocalFile = () => {
    setLocalEntries(null);
    setLocalFilename('');
  };

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 shrink-0">
            <ScrollText className="w-5 h-5 text-gray-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900">System Logs</h2>
            </div>
            <p className="text-sm text-gray-500">System-wide audit event log. Today's events shown by default.</p>
          </div>
        </div>
      </div>

      {/* Toggles */}
      <AuditTogglesCard />

      {/* Local file banner */}
      {localEntries && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800">
          <FolderOpen className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Viewing local file: <strong>{localFilename}</strong> ({localEntries.length} entries)</span>
          <button
            type="button"
            onClick={clearLocalFile}
            className="ml-auto shrink-0 p-0.5 hover:text-amber-600 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Date picker row — only shown when not viewing a local file */}
      {!localEntries && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-gray-600 shrink-0">Log date:</span>
          {filesLoading ? (
            <Skeleton className="h-8 w-40" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {(files ?? []).map((f) => {
                const isActive = (f.date === today && !selectedDate) || f.date === selectedDate;
                return (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => setSelectedDate(f.date === today ? '' : f.date)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-mono border transition-colors ${
                      isActive
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {f.date === today ? `Today (${f.date})` : f.date}
                    {f.compressed && <span className="text-gray-400">.gz</span>}
                    {isActive && !entriesLoading && entriesData && (
                      <span className="ml-0.5 px-1.5 py-0 rounded-full text-[10px] font-sans font-semibold bg-white/20 text-white leading-4">
                        {entriesData.total}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {/* Load from file */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".jsonl,.jsonl.gz,.gz"
              className="hidden"
              onChange={handleLoadFile}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <FolderOpen className="h-4 w-4 mr-1.5" />
              Load File
            </Button>
            {/* Download */}
            <Button
              variant="outline"
              size="sm"
              disabled={downloadMutation.isPending}
              onClick={handleDownload}
            >
              <Download className="h-4 w-4 mr-1.5" />
              {downloadMutation.isPending ? 'Downloading…' : 'Download'}
            </Button>
          </div>
        </div>
      )}

      {/* When viewing local file — show load/clear buttons */}
      {localEntries && (
        <div className="flex justify-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".jsonl,.jsonl.gz,.gz"
            className="hidden"
            onChange={handleLoadFile}
          />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <FolderOpen className="h-4 w-4 mr-1.5" />
            Load Another File
          </Button>
        </div>
      )}

      {/* Filter row */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select
          value={category || '_all'}
          onValueChange={(v) => setCategory(v === '_all' ? '' : v as AuditCategory)}
        >
          <SelectTrigger className="h-8 w-36 text-xs border-gray-300 bg-white">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All categories</SelectItem>
            <SelectItem value="BACKUP">Backup</SelectItem>
            <SelectItem value="AUTH">Auth</SelectItem>
            <SelectItem value="USER_MANAGEMENT">User Management</SelectItem>
            <SelectItem value="SETTINGS">Settings</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={severity || '_all'}
          onValueChange={(v) => setSeverity(v === '_all' ? '' : v as AuditSeverity)}
        >
          <SelectTrigger className="h-8 w-28 text-xs border-gray-300 bg-white">
            <SelectValue placeholder="All levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All levels</SelectItem>
            <SelectItem value="INFO">INFO</SelectItem>
            <SelectItem value="WARN">WARN</SelectItem>
            <SelectItem value="ERROR">ERROR</SelectItem>
          </SelectContent>
        </Select>

        <Input
          className="h-8 w-44 text-xs border-gray-300 bg-white"
          placeholder="Search…"
          value={q}
          onChange={(e) => handleQChange(e.target.value)}
        />

        {(category || severity || q) && (
          <Button
            variant="ghost" size="sm"
            onClick={() => {
              setCategory(''); setSeverity('');
              setQ(''); setDebouncedQ('');
            }}
          >
            <X className="h-4 w-4 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Entries table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
              <tr>
                <th className="text-left px-3 py-2 text-gray-500 font-medium whitespace-nowrap w-36">Time</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium w-20">Category</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Action</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium w-16">Level</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium w-40">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(entriesLoading && !localEntries) ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="px-3 py-2">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              ) : displayEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                    {localEntries ? 'No entries match the current filters' : 'No audit entries for this date / filter'}
                  </td>
                </tr>
              ) : (
                displayEntries.map((entry, idx) => (
                  <tr
                    key={`${entry.timestamp}-${idx}`}
                    className="hover:bg-gray-50 cursor-pointer transition-colors duration-75"
                    onClick={() => setDetailEntry(entry)}
                  >
                    <td className="px-3 py-2 text-gray-500 font-mono whitespace-nowrap">
                      {formatTs(entry.timestamp)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1 text-gray-600">
                        {categoryIcon(entry.category)}
                        {entry.category}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-700">{entry.action}</td>
                    <td className="px-3 py-2">{severityBadge(entry.severity)}</td>
                    <td className="px-3 py-2 text-gray-500 truncate max-w-[160px]">
                      {entry.actor?.email ?? entry.actor?.userId ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Count footer */}
        {totalCount > 0 && (
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              {totalCount} event{totalCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      <EntryDetailDialog entry={detailEntry} onClose={() => setDetailEntry(null)} />
    </div>
  );
}
