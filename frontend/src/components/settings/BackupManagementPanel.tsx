import { useRef, useState } from 'react';
import { AlertTriangle, Database, Download, FolderOpen, HardDrive, Play, RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import { useBackupList, useCreateBackup, useDeleteBackup, useDownloadBackup, useDryRunRestore, useRestoreBackup, useUploadBackup } from '@/hooks/useBackup';
import { useBackupCompatAll } from '@/hooks/useAuditLog';
import type { BackupCompatEntry } from '@/api/audit.api';
import { useToast } from '@/hooks/use-toast';
import { BackupProgressModal } from './BackupProgressModal';
import type { BackupEntry, BackupStorage } from '@/types/backup.types';
import type { BackupCompatibility } from '@/types/audit.types';

type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

type BackupProgressState = { open: boolean; promise: Promise<unknown> | null; dest: BackupStorage };
type RestoreProgressState = { open: boolean; promise: Promise<unknown> | null; isRemoteOnly: boolean };

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function parseBackupDate(filename: string): Date | null {
  const match = filename.match(/tms-backup-(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(`${match[1]}T${match[2]}:${match[3]}:${match[4]}`);
}

function formatBackupDate(filename: string): string {
  const d = parseBackupDate(filename);
  if (!d) return filename;
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function frequencyLabel(freq: Frequency, day: number | null | undefined, time: string): string {
  if (freq === 'WEEKLY') return `Every ${DAY_NAMES[day ?? 1] ?? 'Monday'} at ${time}`;
  if (freq === 'MONTHLY') return `Day ${day ?? 1} of each month at ${time}`;
  return `Daily at ${time}`;
}

// ─── Destination button group ─────────────────────────────────────────────────

const DESTINATION_OPTIONS: { value: BackupStorage; label: string; icon: React.ReactNode }[] = [
  { value: 'local', label: 'Local', icon: <HardDrive className="h-3.5 w-3.5" /> },
  { value: 'remote', label: 'Remote', icon: <Upload className="h-3.5 w-3.5" /> },
  { value: 'both', label: 'Both', icon: <Database className="h-3.5 w-3.5" /> },
];

function DestinationSelector({
  value,
  onChange,
}: {
  value: BackupStorage;
  onChange: (v: BackupStorage) => void;
}) {
  return (
    <div className="flex gap-1" role="group" aria-label="Backup destination">
      {DESTINATION_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors duration-150 cursor-pointer ${value === opt.value
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Storage badge ────────────────────────────────────────────────────────────

function StorageBadge({ storage }: { storage: BackupEntry['storage'] }) {
  if (storage === 'both') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
        <Database className="h-3 w-3" />
        Local + Remote
      </span>
    );
  }
  if (storage === 'remote') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
        <Upload className="h-3 w-3" />
        Remote
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
      <HardDrive className="h-3 w-3" />
      Local
    </span>
  );
}

// ─── Compat badge ─────────────────────────────────────────────────────────────

function CompatBadge({ entry, storage }: { entry: BackupCompatEntry | undefined; storage: BackupEntry['storage'] }) {
  if (!entry) {
    if (storage === 'remote') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-gray-400 border border-gray-200 bg-gray-50" title="Download locally to check compatibility">
          Remote only
        </span>
      );
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-gray-300">—</span>;
  }
  if (!entry.compat) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-gray-400">Legacy</span>;
  }
  if (entry.compat.status === 'ok') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
        Compatible
      </span>
    );
  }
  if (entry.compat.status === 'older') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
        Schema Rollback
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
      Schema Ahead
    </span>
  );
}

// ─── Restore confirm dialog ───────────────────────────────────────────────────

interface RestoreDialogProps {
  open: boolean;
  filename: string;
  compatibility?: BackupCompatibility;
  onConfirm: (force: boolean) => void;
  onCancel: () => void;
}

function RestoreConfirmDialog({ open, filename, compatibility, onConfirm, onCancel }: RestoreDialogProps) {
  const [confirmText, setConfirmText] = useState('');

  if (!open) return null;

  const needsForce = compatibility && compatibility.status !== 'ok';
  const requiredWord = needsForce ? 'FORCE' : 'RESTORE';
  const isReady = confirmText === requiredWord;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <RotateCcw className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Restore Database</h3>
            <p className="text-sm text-gray-500 mt-1">
              This will <strong>overwrite ALL current data</strong> with the backup contents.
              This action cannot be undone. The application should not be used during restore.
            </p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-md p-3">
          <p className="text-xs text-gray-500 mb-1">Backup file</p>
          <code className="text-xs font-mono text-gray-800 break-all">{filename}</code>
        </div>

        {/* Migration level info */}
        {compatibility && (
          <div className="bg-gray-50 rounded-md px-3 py-2 border border-gray-100 text-xs space-y-1.5">
            <div className="flex items-center gap-2 text-gray-500">
              <span className="shrink-0">Backup migration</span>
              <span className="font-mono font-semibold text-gray-800 truncate" title={compatibility.backupLastMigration}>
                {compatibility.backupLastMigration
                  ? compatibility.backupLastMigration.replace(/^\d{14}_/, '')
                  : `(${compatibility.backupMigrationCount} applied)`}
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-500">
              <span className="shrink-0">Current migration</span>
              <span className="font-mono font-semibold text-gray-800 truncate" title={compatibility.currentLastMigration}>
                {compatibility.currentLastMigration
                  ? compatibility.currentLastMigration.replace(/^\d{14}_/, '')
                  : `(${compatibility.currentMigrationCount} applied)`}
              </span>
              {compatibility.status === 'ok' && (
                <span className="ml-auto shrink-0 px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">compatible</span>
              )}
              {compatibility.status === 'older' && (
                <span className="ml-auto shrink-0 px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">−{compatibility.missing.length} migrations</span>
              )}
              {compatibility.status === 'newer' && (
                <span className="ml-auto shrink-0 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">+{compatibility.extra.length} migrations</span>
              )}
            </div>
          </div>
        )}

        {/* Compatibility warning */}
        {compatibility && compatibility.status === 'older' && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 space-y-2">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <p className="text-xs font-semibold">Schema downgrade detected</p>
            </div>
            <p className="text-xs text-red-600">
              This backup predates your current database migrations. Restoring will <strong>downgrade the schema</strong> and likely cause runtime errors.
            </p>
            {compatibility.missing.length > 0 && (
              <div>
                <p className="text-xs text-red-500 font-medium mb-1">Migrations that will be lost ({compatibility.missing.length}):</p>
                <ul className="space-y-0.5 max-h-28 overflow-y-auto">
                  {compatibility.missing.map((m) => (
                    <li key={m} className="text-xs font-mono text-red-600 bg-red-100 rounded px-1.5 py-0.5">{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {compatibility && compatibility.status === 'newer' && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <p className="text-xs font-semibold">Schema ahead of code</p>
            </div>
            <p className="text-xs text-amber-600">
              This backup contains migrations your current code has not applied. The database schema may be ahead of the running application.
            </p>
            {compatibility.extra.length > 0 && (
              <div>
                <p className="text-xs text-amber-500 font-medium mb-1">Unapplied migrations in backup ({compatibility.extra.length}):</p>
                <ul className="space-y-0.5 max-h-28 overflow-y-auto">
                  {compatibility.extra.map((m) => (
                    <li key={m} className="text-xs font-mono text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div>
          <p className="text-sm text-gray-700 mb-1.5">
            Type <strong>{requiredWord}</strong> to confirm:
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={requiredWord}
            className="font-mono"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => { setConfirmText(''); onCancel(); }}>Cancel</Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={!isReady}
            onClick={() => { onConfirm(!!needsForce); setConfirmText(''); }}
          >
            {needsForce ? 'Force Restore' : 'Restore Database'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function BackupManagementPanel() {
  const { toast } = useToast();
  const { data: settings } = useSettings();
  const updateMutation = useUpdateSettings();
  const { data: backups, isLoading } = useBackupList();
  const createMutation = useCreateBackup();
  const deleteMutation = useDeleteBackup();
  const downloadMutation = useDownloadBackup();
  const dryRunMutation = useDryRunRestore();
  const restoreMutation = useRestoreBackup();
  const uploadMutation = useUploadBackup();

  const { data: compatAll } = useBackupCompatAll();
  const compatMap = new Map((compatAll ?? []).map((e) => [e.filename, e]));

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Schedule form local state ──
  const [enabledLocal, setEnabledLocal] = useState<boolean | null>(null);
  const [frequency, setFrequency] = useState<Frequency | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [retainCount, setRetainCount] = useState<number | null>(null);
  const [destLocal, setDestLocal] = useState<BackupStorage | null>(null);

  const resolvedEnabled  = enabledLocal ?? settings?.autoBackupEnabled ?? true;
  const resolvedFrequency = (frequency ?? settings?.autoBackupFrequency ?? 'DAILY') as Frequency;
  const resolvedDay  = day  ?? settings?.autoBackupDay  ?? 1;
  const resolvedTime = time ?? settings?.autoBackupTime ?? '03:00';
  const resolvedRetainCount = retainCount ?? settings?.autoBackupRetainCount ?? 7;
  const resolvedDest = (destLocal ?? settings?.autoBackupDestination ?? 'both') as BackupStorage;

  const scheduleIsDirty =
    resolvedFrequency    !== (settings?.autoBackupFrequency ?? 'DAILY') ||
    resolvedDay          !== (settings?.autoBackupDay ?? 1) ||
    resolvedTime         !== (settings?.autoBackupTime ?? '03:00') ||
    resolvedRetainCount !== (settings?.autoBackupRetainCount ?? 7) ||
    resolvedDest !== ((settings?.autoBackupDestination ?? 'both') as BackupStorage);

  // ── Manual backup destination ──
  const [manualDest, setManualDest] = useState<BackupStorage>('both');

  // ── Delete state ──
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // ── Restore state ──
  const [restoreTarget, setRestoreTarget] = useState<{ filename: string; compatibility?: BackupCompatibility } | null>(null);

  // ── Backup progress modal state ──
  const [backupProgress, setBackupProgress] = useState<BackupProgressState>({ open: false, promise: null, dest: 'both' });
  const [restoreProgress, setRestoreProgress] = useState<RestoreProgressState>({ open: false, promise: null, isRemoteOnly: false });

  // ── Handlers ──
  const handleToggle = async () => {
    const newValue = !resolvedEnabled;
    setEnabledLocal(newValue);
    try {
      await updateMutation.mutateAsync({ autoBackupEnabled: newValue });
      toast({ title: newValue ? 'Auto-backup enabled' : 'Auto-backup disabled' });
    } catch {
      setEnabledLocal(null);
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  const handleSaveSchedule = async () => {
    if (resolvedFrequency === 'WEEKLY' && (resolvedDay < 0 || resolvedDay > 6)) {
      toast({ title: 'Invalid day', description: 'Please select a valid day of the week.', variant: 'destructive' });
      return;
    }
    if (resolvedFrequency === 'MONTHLY' && (resolvedDay < 1 || resolvedDay > 28)) {
      toast({ title: 'Invalid day', description: 'Day of month must be between 1 and 28.', variant: 'destructive' });
      return;
    }
    try {
      await updateMutation.mutateAsync({
        autoBackupFrequency: resolvedFrequency,
        autoBackupDay: resolvedFrequency !== 'DAILY' ? resolvedDay : null,
        autoBackupTime: resolvedTime,
        autoBackupDestination: resolvedDest,
        autoBackupRetainCount: resolvedRetainCount,
      });
      toast({ title: 'Backup schedule saved' });
      setFrequency(null);
      setDay(null);
      setTime(null);
      setRetainCount(null);
      setDestLocal(null);
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' });
    }
  };

  const BACKUP_FILENAME_REGEX = /^tms-backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.(tar\.gz|sql\.gz)$/;

  const handleFileLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so same file can be re-selected
    if (!file) return;
    if (!BACKUP_FILENAME_REGEX.test(file.name)) {
      toast({
        title: 'Invalid filename',
        description: 'File must be named: tms-backup-YYYY-MM-DD_HH-MM-SS.tar.gz',
        variant: 'destructive',
      });
      return;
    }
    try {
      await uploadMutation.mutateAsync(file);
      toast({ title: 'Backup loaded', description: `${file.name} added to backups.` });
    } catch (err) {
      toast({
        title: 'Upload failed',
        description: err instanceof Error ? err.message : 'Could not upload backup file.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateBackup = () => {
    const promise = createMutation.mutateAsync(manualDest);
    setBackupProgress({ open: true, promise, dest: manualDest });
  };

  const handleBackupComplete = () => {
    setBackupProgress((s) => ({ ...s, open: false }));
    toast({ title: 'Backup created', description: 'The database has been backed up successfully.' });
  };

  const handleBackupError = (msg: string) => {
    setBackupProgress((s) => ({ ...s, open: false }));
    toast({ title: 'Backup failed', description: msg, variant: 'destructive' });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget);
      toast({ title: 'Backup deleted' });
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      await downloadMutation.mutateAsync(filename);
    } catch {
      toast({ title: 'Download failed', variant: 'destructive' });
    }
  };

  const handleRestoreConfirm = (force: boolean) => {
    if (!restoreTarget) return;
    const targetBackup = backups?.find((b) => b.filename === restoreTarget.filename);
    const isRemoteOnly = targetBackup?.storage === 'remote';
    const promise = restoreMutation.mutateAsync({ filename: restoreTarget.filename, force });
    setRestoreTarget(null);
    setRestoreProgress({ open: true, promise, isRemoteOnly });
  };

  const handleRestoreComplete = () => {
    setRestoreProgress((s) => ({ ...s, open: false }));
    toast({ title: 'Restore complete', description: 'The database has been restored successfully.' });
  };

  const handleRestoreError = (msg: string) => {
    setRestoreProgress((s) => ({ ...s, open: false }));
    toast({ title: 'Restore failed', description: msg, variant: 'destructive' });
  };

  return (
    <div className="space-y-6">
      {/* ── Schedule card ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-1">
          <Database className="h-4 w-4 text-gray-900" />
          <p className="text-sm font-semibold text-gray-800">Backup Schedule</p>
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          Automatic backups are compressed SQL dumps. Configure where they are stored and how many to keep.
        </p>

        <div className="space-y-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Auto-backup</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {resolvedEnabled
                  ? frequencyLabel(resolvedFrequency, resolvedDay, resolvedTime)
                  : 'Disabled'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={resolvedEnabled}
              onClick={handleToggle}
              disabled={updateMutation.isPending}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${resolvedEnabled ? 'bg-green-600' : 'bg-gray-200'
                }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${resolvedEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
            </button>
          </div>

          {resolvedEnabled && (
            <div className="space-y-3">
              {/* Frequency */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1.5">Frequency</p>
                <div className="flex gap-1" role="group" aria-label="Backup frequency">
                  {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setFrequency(freq)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors duration-150 cursor-pointer ${resolvedFrequency === freq
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                      {freq.charAt(0) + freq.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Day of week — WEEKLY only */}
              {resolvedFrequency === 'WEEKLY' && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Day of week</p>
                  <select
                    value={resolvedDay}
                    onChange={(e) => setDay(parseInt(e.target.value, 10))}
                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                  >
                    {DAY_NAMES.map((name, idx) => (
                      <option key={idx} value={idx}>{name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Day of month — MONTHLY only */}
              {resolvedFrequency === 'MONTHLY' && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Day of month</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number" min={1} max={28}
                      value={resolvedDay}
                      onChange={(e) => setDay(parseInt(e.target.value, 10) || 1)}
                      className="w-24 h-9"
                    />
                    <span className="text-sm text-gray-500">of each month</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Max 28 — safe for all months.</p>
                </div>
              )}

              {/* Time */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Run at</p>
                <Input
                  type="time"
                  value={resolvedTime}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-32 h-9"
                />
              </div>

              {/* Destination */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1.5">Storage destination</p>
                <DestinationSelector value={resolvedDest} onChange={setDestLocal} />
                <p className="text-xs text-gray-400 mt-1">
                  Remote requires S3-compatible storage to be configured (see <code className="font-mono">.env</code>).
                </p>
              </div>

            </div>
          )}

          {/* Retention — always visible */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1.5">Keep last</p>
            <div className="flex items-center gap-2">
              <Input
                type="number" min={1} max={365}
                value={resolvedRetainCount}
                onChange={(e) => setRetainCount(parseInt(e.target.value, 10) || 14)}
                className="w-24 h-9"
              />
              <span className="text-sm text-gray-500">backups</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Oldest backups beyond this limit are deleted automatically — applies to both manual and scheduled backups.
            </p>
          </div>

          <div className="flex justify-end pt-4 mt-2 border-t border-gray-100">
            <Button
              type="button"
              size="sm"
              onClick={handleSaveSchedule}
              disabled={!scheduleIsDirty || updateMutation.isPending}
              className="active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateMutation.isPending ? 'Saving…' : 'Save Configuration'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Backups list card ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-sm font-semibold text-gray-800">Backups</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {backups?.length ? `${backups.length} backup${backups.length === 1 ? '' : 's'} available` : 'No backups yet'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DestinationSelector value={manualDest} onChange={setManualDest} />
            <Button
              type="button"
              size="sm"
              onClick={handleCreateBackup}
              disabled={createMutation.isPending}
              className="gap-2 active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
            >
              <Play className="h-3.5 w-3.5" />
              Create Backup Now
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : !backups?.length ? (
          <div className="text-center py-10 text-sm text-gray-400">
            No backups yet. Click "Create Backup Now" to create your first backup.
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[240px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Date / Time</th>
                  <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Size</th>
                  <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Storage</th>
                  <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Status</th>
                  <th className="text-right text-xs font-medium text-gray-500 pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {backups.map((backup) => (
                  <tr key={backup.filename} className="hover:bg-gray-50 transition-colors duration-100">
                    <td className="py-2.5 pr-4">
                      <span className="font-mono text-xs text-gray-800">
                        {formatBackupDate(backup.filename)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-gray-600">
                      {formatBytes(backup.sizeBytes)}
                    </td>
                    <td className="py-2.5 pr-4">
                      <StorageBadge storage={backup.storage} />
                    </td>
                    <td className="py-2.5 pr-4">
                      <CompatBadge entry={compatMap.get(backup.filename)} storage={backup.storage} />
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="Download"
                          onClick={() => handleDownload(backup.filename)}
                          disabled={downloadMutation.isPending}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors duration-100 cursor-pointer disabled:opacity-50"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Restore"
                          disabled={dryRunMutation.isPending && dryRunMutation.variables === backup.filename}
                          onClick={() => {
                            dryRunMutation.mutate(backup.filename, {
                              onSuccess: (result) => {
                                setRestoreTarget({ filename: backup.filename, compatibility: result.compatibility });
                              },
                              onError: () => {
                                toast({ title: 'Could not verify backup compatibility', variant: 'destructive' });
                              },
                            });
                          }}
                          className="p-1.5 rounded hover:bg-amber-50 text-amber-500 hover:text-amber-700 transition-colors duration-100 cursor-pointer disabled:opacity-50"
                        >
                          <RotateCcw className={`h-3.5 w-3.5 ${dryRunMutation.isPending && dryRunMutation.variables === backup.filename ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => setDeleteTarget(backup.filename)}
                          className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors duration-100 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gray-100">
          <input
            ref={fileInputRef}
            type="file"
            accept=".tar.gz,.gz"
            className="hidden"
            onChange={handleFileLoad}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="gap-2 active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {uploadMutation.isPending ? 'Loading…' : 'Load Backup'}
          </Button>
        </div>
      </div>

      {/* ── Delete confirm ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Backup"
        description={`Are you sure you want to delete "${deleteTarget ?? ''}"? This will remove it from local storage and remote (if applicable).`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isPending={deleteMutation.isPending}
        isDestructive
      />

      {/* ── Restore confirm ── */}
      <RestoreConfirmDialog
        open={!!restoreTarget}
        filename={restoreTarget?.filename ?? ''}
        compatibility={restoreTarget?.compatibility}
        onConfirm={handleRestoreConfirm}
        onCancel={() => setRestoreTarget(null)}
      />

      {/* ── Backup progress modal ── */}
      <BackupProgressModal
        open={backupProgress.open}
        mode="backup"
        destination={backupProgress.dest}
        apiPromise={backupProgress.promise}
        onComplete={handleBackupComplete}
        onError={handleBackupError}
      />

      {/* ── Restore progress modal ── */}
      <BackupProgressModal
        open={restoreProgress.open}
        mode="restore"
        isRemoteOnly={restoreProgress.isRemoteOnly}
        apiPromise={restoreProgress.promise}
        onComplete={handleRestoreComplete}
        onError={handleRestoreError}
      />
    </div>
  );
}
