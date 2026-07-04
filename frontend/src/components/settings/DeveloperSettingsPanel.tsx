import { useState } from 'react';
import { AlertTriangle, Gauge, Save, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useSettings, useUpdateSettings, useSystemInfo } from '@/hooks/useSettings';
import { useToast } from '@/hooks/use-toast';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DeveloperSettingsPanel() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useSettings();
  const { data: systemInfo, isLoading: sysLoading } = useSystemInfo();
  const updateMutation = useUpdateSettings();

  // Maintenance state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const maintenanceEnabled = settings?.maintenanceEnabled ?? false;

  // Rate limit state
  const [rateLimitPerUser, setRateLimitPerUser] = useState<number | ''>('');
  const rateLimitEnabled = settings?.rateLimitEnabled ?? true;
  const rateLimitValue = rateLimitPerUser !== '' ? rateLimitPerUser : (settings?.rateLimitPerUser ?? 50);

  // Sync message from server when settings load
  const messageValue = maintenanceMessage || settings?.maintenanceMessage || '';

  // ── Maintenance handlers ────────────────────────────────────────────────

  const handleActivateMaintenance = async () => {
    setConfirmOpen(false);
    try {
      await updateMutation.mutateAsync({
        maintenanceEnabled: true,
        maintenanceMessage: messageValue,
      });
      toast({ title: 'Maintenance mode activated' });
    } catch {
      toast({ title: 'Failed to activate maintenance', variant: 'destructive' });
    }
  };

  const handleDeactivateMaintenance = async () => {
    try {
      await updateMutation.mutateAsync({
        maintenanceEnabled: false,
        maintenanceMessage: '',
      });
      setMaintenanceMessage('');
      toast({ title: 'Maintenance mode deactivated' });
    } catch {
      toast({ title: 'Failed to deactivate maintenance', variant: 'destructive' });
    }
  };

  // ── Rate limit handlers ─────────────────────────────────────────────────

  const handleToggleRateLimit = async () => {
    try {
      await updateMutation.mutateAsync({ rateLimitEnabled: !rateLimitEnabled });
      toast({ title: rateLimitEnabled ? 'Rate limiting disabled' : 'Rate limiting enabled' });
    } catch {
      toast({ title: 'Failed to update rate limiting', variant: 'destructive' });
    }
  };

  const handleSaveRateLimit = async () => {
    const value = typeof rateLimitValue === 'number' ? rateLimitValue : 50;
    try {
      await updateMutation.mutateAsync({ rateLimitPerUser: value });
      toast({ title: `Rate limit set to ${value} requests/min` });
    } catch {
      toast({ title: 'Failed to save rate limit', variant: 'destructive' });
    }
  };

  // ── Loading skeleton ────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-6">
            <Skeleton className="h-5 w-40 mb-4" />
            <Skeleton className="h-4 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Card 1 — Maintenance Mode */}
      <div className={`bg-white border rounded-lg p-6 ${maintenanceEnabled ? 'border-red-300 bg-red-50/30' : 'border-gray-200'}`}>
        <div className="flex items-center gap-3 mb-1">
          <AlertTriangle className={`h-4 w-4 ${maintenanceEnabled ? 'text-red-600' : 'text-gray-900'}`} />
          <p className="text-sm font-semibold text-gray-800">Maintenance Mode</p>
          {maintenanceEnabled && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              Active
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          Block all users from accessing the application during database migrations or backups. Only your system admin account retains access.
        </p>

        {/* Message textarea */}
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-1.5 block">
            Maintenance message
          </label>
          <Textarea
            placeholder="e.g. Scheduled maintenance in progress. We'll be back shortly."
            maxLength={500}
            value={messageValue}
            onChange={(e) => setMaintenanceMessage(e.target.value)}
            className="resize-none h-20"
            disabled={maintenanceEnabled}
          />
          <p className="text-xs text-right text-gray-400 mt-1">{messageValue.length}/500</p>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end">
          {maintenanceEnabled ? (
            <Button
              type="button"
              onClick={() => { void handleDeactivateMaintenance(); }}
              disabled={updateMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
            >
              {updateMutation.isPending ? 'Deactivating...' : 'Deactivate Maintenance'}
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
              disabled={updateMutation.isPending}
            >
              Activate Maintenance
            </Button>
          )}
        </div>

        <ConfirmDialog
          open={confirmOpen}
          title="Activate Maintenance Mode?"
          description="This will immediately block all users from accessing the application. Only your system admin account will retain access. Cron jobs (auto-archive, auto-backup) will also be paused. Are you sure?"
          confirmLabel="Activate"
          isDestructive
          onConfirm={handleActivateMaintenance}
          onCancel={() => setConfirmOpen(false)}
        />
      </div>

      {/* Card 2 — Rate Limiting */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-1">
          <Gauge className="h-4 w-4 text-gray-900" />
          <p className="text-sm font-semibold text-gray-800">Rate Limiting</p>
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          Limit how many API requests each user can make per minute. Prevents API abuse and protects server resources.
        </p>

        {/* Toggle */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-gray-700">Enable rate limiting</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {rateLimitEnabled ? 'Users are limited to a set number of requests per minute' : 'Rate limiting is disabled — no request restrictions'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={rateLimitEnabled}
            onClick={() => { void handleToggleRateLimit(); }}
            disabled={updateMutation.isPending}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${rateLimitEnabled ? 'bg-green-600' : 'bg-gray-200'
              }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${rateLimitEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
            />
          </button>
        </div>

        {/* Requests per user */}
        {rateLimitEnabled && (
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Requests per user per minute
              </label>
              <Input
                type="number"
                min={10}
                max={500}
                value={rateLimitValue}
                onChange={(e) => setRateLimitPerUser(e.target.value ? Number(e.target.value) : '')}
                className="w-32"
              />
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => { void handleSaveRateLimit(); }}
              disabled={updateMutation.isPending}
              className="active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateMutation.isPending ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        )}
      </div>

      {/* Card 3 — System Information */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-1">
          <Server className="h-4 w-4 text-gray-900" />
          <p className="text-sm font-semibold text-gray-800">System Information</p>
          <span className="ml-auto text-xs text-gray-400">Auto-refreshes every 60s</span>
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          Read-only overview of server health and performance metrics.
        </p>

        {sysLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i}>
                <Skeleton className="h-3 w-24 mb-1" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        ) : systemInfo ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoItem label="Server Uptime" value={formatUptime(systemInfo.uptime)} />
            <InfoItem label="Node.js Version" value={systemInfo.nodeVersion} />
            <InfoItem label="Database Size" value={formatBytes(systemInfo.databaseSizeBytes)} />
            <InfoItem label="Avg Response Time" value={`${systemInfo.avgResponseTime.toFixed(1)} ms`} />
            <InfoItem label="P95 Response Time" value={`${systemInfo.p95ResponseTime.toFixed(1)} ms`} />
            <InfoItem label="Requests/min" value={systemInfo.requestsPerMinute.toFixed(1)} />
            <InfoItem label="Total Requests" value={systemInfo.totalRequests.toLocaleString()} />
            <InfoItem
              label="Environment"
              value={systemInfo.environment}
              valueClassName={systemInfo.environment === 'production' ? 'text-green-700' : 'text-amber-600'}
            />
          </div>
        ) : (
          <p className="text-sm text-gray-500">Unable to load system information.</p>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface InfoItemProps {
  label: string;
  value: string;
  valueClassName?: string;
}

function InfoItem({ label, value, valueClassName }: InfoItemProps) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-sm font-medium text-gray-900 ${valueClassName ?? ''}`}>{value}</p>
    </div>
  );
}
