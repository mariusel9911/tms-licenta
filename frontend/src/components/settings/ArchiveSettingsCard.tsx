import { useState } from 'react';
import { Archive, Play, Save } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import { useArchiveOrders } from '@/hooks/useOrders';
import { useToast } from '@/hooks/use-toast';
import type { UseFormReturn } from 'react-hook-form';

type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function frequencyLabel(freq: Frequency, day: number | null | undefined, time: string): string {
  if (freq === 'WEEKLY') {
    return `Runs every ${DAY_NAMES[day ?? 1] ?? 'Monday'} at ${time}`;
  }
  if (freq === 'MONTHLY') {
    return `Runs on day ${day ?? 1} of each month at ${time}`;
  }
  return `Runs daily at ${time}`;
}

export interface ArchiveFormFields {
  autoArchiveAfterMonths?: number;
  autoArchiveFrequency?: string;
  autoArchiveDay?: number | null;
  autoArchiveTime?: string;
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<ArchiveFormFields & Record<string, any>>;
}

export function ArchiveSettingsCard({ form }: Props) {
  const { toast } = useToast();
  const { data: settings } = useSettings();
  const updateMutation = useUpdateSettings();
  const archiveMutation = useArchiveOrders();

  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);

  // Toggle is local + auto-saved immediately (not part of the main form)
  const [enabledLocal, setEnabledLocal] = useState<boolean | null>(null);
  const resolvedEnabled = enabledLocal ?? settings?.autoArchiveEnabled ?? true;

  // Schedule fields come from the parent form
  const months = form.watch('autoArchiveAfterMonths') ?? 3;
  const frequency = (form.watch('autoArchiveFrequency') ?? 'DAILY') as Frequency;
  const day = form.watch('autoArchiveDay') ?? (frequency === 'WEEKLY' ? 1 : 1);
  const time = form.watch('autoArchiveTime') ?? '02:00';

  // Check if schedule fields are dirty (for the local "Save Configuration" button)
  const scheduleIsDirty =
    months !== (settings?.autoArchiveAfterMonths ?? 3) ||
    frequency !== (settings?.autoArchiveFrequency ?? 'DAILY') ||
    day !== (settings?.autoArchiveDay ?? 1) ||
    time !== (settings?.autoArchiveTime ?? '02:00');

  // Toggle auto-save — fires immediately
  const handleToggle = async () => {
    const newValue = !resolvedEnabled;
    setEnabledLocal(newValue);
    try {
      await updateMutation.mutateAsync({ autoArchiveEnabled: newValue });
      toast({ title: newValue ? 'Auto-archive enabled' : 'Auto-archive disabled' });
    } catch {
      setEnabledLocal(null); // revert on failure
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  // Save just the schedule fields (convenience shortcut)
  const handleSaveSchedule = async () => {
    const parsedMonths = months;
    if (parsedMonths < 3 || parsedMonths > 120) {
      toast({ title: 'Invalid value', description: 'Months must be between 3 and 120.', variant: 'destructive' });
      return;
    }
    if (frequency === 'WEEKLY') {
      if (day < 0 || day > 6) {
        toast({ title: 'Invalid day', description: 'Please select a valid day of the week.', variant: 'destructive' });
        return;
      }
    }
    if (frequency === 'MONTHLY') {
      if (day < 1 || day > 28) {
        toast({ title: 'Invalid day', description: 'Day of month must be between 1 and 28.', variant: 'destructive' });
        return;
      }
    }
    try {
      await updateMutation.mutateAsync({
        autoArchiveAfterMonths: parsedMonths,
        autoArchiveFrequency: frequency,
        autoArchiveDay: frequency !== 'DAILY' ? day : null,
        autoArchiveTime: time,
      });
      toast({ title: 'Archive schedule saved' });
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' });
    }
  };

  const handleArchiveNow = async () => {
    try {
      const result = await archiveMutation.mutateAsync();
      toast({
        title: 'Archive complete',
        description: result.archived === 0
          ? 'No orders qualified for archiving.'
          : `${result.archived} order${result.archived === 1 ? '' : 's'} archived.`,
      });
    } catch {
      toast({ title: 'Archive failed', variant: 'destructive' });
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-1">
        <Archive className="h-4 w-4 text-gray-900" />
        <p className="text-sm font-semibold text-gray-800">Order Archiving</p>
      </div>
      <p className="text-xs text-muted-foreground mb-5">
        Completed and cancelled orders older than the configured threshold are automatically
        archived and excluded from the main orders list.
      </p>

      <div className="space-y-4">
        {/* Archive older than — always visible, used for both auto and manual */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Archive older than</p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={120}
              value={months}
              onChange={(e) => form.setValue('autoArchiveAfterMonths', parseInt(e.target.value, 10) || 3, { shouldDirty: true })}
              className="w-24 h-9"
            />
            <span className="text-sm text-gray-500">months</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Applies to both manual and automatic archiving.
          </p>
        </div>

        {/* Enable / Disable toggle row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Auto-archive</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {resolvedEnabled
                ? frequencyLabel(frequency, day, time)
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
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${resolvedEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
            />
          </button>
        </div>

        {/* Schedule config — only when auto-archive is enabled */}
        {resolvedEnabled && (
          <div className="space-y-3 pl-0">
            {/* Frequency selector */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1.5">Frequency</p>
              <div className="flex gap-1" role="group" aria-label="Archive frequency">
                {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => form.setValue('autoArchiveFrequency', freq, { shouldDirty: true })}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors duration-150 cursor-pointer ${frequency === freq
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
            {frequency === 'WEEKLY' && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Day of week</p>
                <select
                  value={day}
                  onChange={(e) => form.setValue('autoArchiveDay', parseInt(e.target.value, 10), { shouldDirty: true })}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                >
                  {DAY_NAMES.map((name, idx) => (
                    <option key={idx} value={idx}>{name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Day of month — MONTHLY only */}
            {frequency === 'MONTHLY' && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Day of month</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={day}
                    onChange={(e) => form.setValue('autoArchiveDay', parseInt(e.target.value, 10) || 1, { shouldDirty: true })}
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
                value={time}
                onChange={(e) => form.setValue('autoArchiveTime', e.target.value, { shouldDirty: true })}
                className="w-32 h-9"
              />
            </div>
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-gray-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setArchiveConfirmOpen(true)}
            disabled={archiveMutation.isPending}
            className="gap-2 active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
          >
            <Play className="h-3.5 w-3.5" />
            {archiveMutation.isPending ? 'Archiving…' : 'Archive Now'}
          </Button>

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

      <ConfirmDialog
        open={archiveConfirmOpen}
        title="Archive Orders"
        description={`You are about to archive all eligible orders (completed or cancelled, finalized more than ${months} month${months === 1 ? '' : 's'} ago).\n\nArchived orders cannot be edited. This action is irreversible from the UI.`}
        confirmLabel="Archive"
        onConfirm={() => {
          setArchiveConfirmOpen(false);
          void handleArchiveNow();
        }}
        onCancel={() => setArchiveConfirmOpen(false)}
      />
    </div>
  );
}
