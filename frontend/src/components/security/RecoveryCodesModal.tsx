import { useState } from 'react';
import { Copy, Download, AlertTriangle, KeyRound } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface RecoveryCodesModalProps {
  open: boolean;
  codes: string[];
  onClose: () => void;
}

export function RecoveryCodesModal({ open, codes, onClose }: RecoveryCodesModalProps) {
  const [confirmed, setConfirmed] = useState(false);
  const { toast } = useToast();

  const handleClose = () => {
    setConfirmed(false);
    onClose();
  };

  const handleCopyAll = async () => {
    await navigator.clipboard.writeText(codes.join('\n'));
    toast({ title: 'Copied', description: 'Recovery codes copied to clipboard.' });
  };

  const handleDownload = () => {
    const content = [
      'TMS Recovery Codes',
      '==================',
      'Each code can only be used once.',
      'Store these in a safe place.',
      '',
      ...codes,
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tms-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        // Block closing via onOpenChange until confirmed
      }}
    >
      <DialogContent
        className="sm:max-w-[500px] p-0 overflow-hidden gap-0"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 px-6 pt-6 pb-5">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-gradient-to-b from-gray-400/15 to-transparent" />
            <div className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full bg-background border border-border shadow-sm">
              <KeyRound className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <DialogTitle className="text-base font-medium text-foreground">Save your recovery codes</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Use these codes to access your account if you lose your authenticator device.
            </DialogDescription>
          </div>
        </div>

        <Separator />

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="px-6 py-5 space-y-4">
          {/* Warning banner */}
          <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
            <span>
              Each code can only be used <strong>once</strong>. Store them somewhere safe —
              you won't be able to see them again.
            </span>
          </div>

          {/* Codes grid */}
          <div className="grid grid-cols-2 gap-1.5 rounded-md bg-muted border border-border p-4">
            {codes.map((code) => (
              <span
                key={code}
                className="font-mono text-sm tracking-widest text-foreground text-center py-1"
              >
                {code}
              </span>
            ))}
          </div>

          {/* Copy + Download buttons */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleCopyAll}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy All
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleDownload}
            >
              <Download className="w-4 h-4 mr-2" />
              Download .txt
            </Button>
          </div>

          {/* Confirmation checkbox */}
          <label className="flex items-center gap-3 cursor-pointer select-none py-1">
            <Checkbox
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
            />
            <span className="text-sm text-foreground">
              I have saved my recovery codes in a safe place
            </span>
          </label>
        </div>

        <Separator />

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <DialogFooter className="px-6 py-4">
          <Button
            type="button"
            onClick={handleClose}
            disabled={!confirmed}
            className="w-full"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
