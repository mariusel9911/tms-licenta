import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { KeyRound, Fingerprint, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { getPasskeyRegistrationOptionsApi, verifyPasskeyRegistrationApi } from '@/api/auth.api';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = 'name' | 'waiting';

export function PasskeySetupModal({ open, onClose }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>('name');
  const [deviceName, setDeviceName] = useState('');
  const [error, setError] = useState('');

  const handleClose = () => {
    setStep('name');
    setDeviceName('');
    setError('');
    onClose();
  };

  const handleRegister = async () => {
    setError('');
    setStep('waiting');

    try {
      // 1. Get registration options from backend
      const options = await getPasskeyRegistrationOptionsApi();

      // 2. Prompt browser authenticator
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const registrationResponse = await startRegistration({ optionsJSON: options as any });

      // 3. Verify with backend
      await verifyPasskeyRegistrationApi(
        registrationResponse as unknown as Record<string, unknown>,
        deviceName.trim() || undefined,
      );

      // 4. Refresh passkeys list
      await queryClient.invalidateQueries({ queryKey: ['auth', 'passkeys'] });

      toast({ title: 'Passkey registered', description: 'Your passkey has been saved.' });
      handleClose();
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      const message = err instanceof Error ? err.message : 'unknown';

      if (name === 'NotAllowedError') {
        setError('Operation was cancelled. Please try again.');
      } else if (name === 'SecurityError') {
        setError('Secure context required. Please use HTTPS.');
      } else if (message === 'no_challenge') {
        setError('Session expired. Please refresh and try again.');
      } else if (message === 'verification_failed') {
        setError('Passkey verification failed. Please try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
      setStep('name');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-[460px] p-0 overflow-hidden gap-0">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 px-6 pt-6 pb-5">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-gradient-to-b from-gray-400/15 to-transparent" />
            <div className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full bg-background border border-border shadow-sm">
              <KeyRound className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <h2 className="text-base font-medium text-foreground">Register Passkey</h2>
            <p className="text-sm text-muted-foreground">
              Use a hardware security key, Touch ID, Windows Hello, or another biometric authenticator.
            </p>
          </div>
        </div>

        <Separator />

        {step === 'name' && (
          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="device-name">Device name (optional)</Label>
              <Input
                id="device-name"
                placeholder="e.g. My YubiKey, MacBook Touch ID"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleRegister(); }}
                maxLength={100}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Helps you identify this passkey later if you register multiple.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={() => void handleRegister()}>
                <Fingerprint className="w-4 h-4 mr-2" />
                Register Passkey
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'waiting' && (
          <div className="px-6 py-10 flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Waiting for authenticator…</p>
              <p className="text-xs text-muted-foreground">
                Touch your security key, approve the biometric prompt, or use your PIN.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleClose}>
              Cancel
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

