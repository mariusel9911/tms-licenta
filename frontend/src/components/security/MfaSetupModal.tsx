import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Shield, CheckCircle2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useSetupMfa, useConfirmMfa } from '@/hooks/useAuth';
import { RecoveryCodesModal } from './RecoveryCodesModal';

const step1Schema = z.object({
  password: z.string().min(1, 'Password is required'),
});
type Step1Values = z.infer<typeof step1Schema>;

interface MfaSetupModalProps {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    title: 'Download app',
    description: 'Download a mobile authenticator app such as Google Authenticator or Authy.',
  },
  {
    title: 'Scan QR code',
    description: 'Open the app and scan the QR code. This will add your TMS account.',
  },
  {
    title: 'Enter code',
    description: 'Enter the 6-digit verification code from your authenticator app.',
  },
];

export function MfaSetupModal({ open, onClose }: MfaSetupModalProps) {
  const { toast } = useToast();
  const setupMutation = useSetupMfa();
  const confirmMutation = useConfirmMfa();

  const [step, setStep] = useState<1 | 2>(1);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  // OTP local state — avoids input-otp + RHF Slot conflict
  const [otpValue, setOtpValue] = useState('');
  const [otpError, setOtpError] = useState('');
  // Recovery codes shown after MFA confirmation
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [showRecovery, setShowRecovery] = useState(false);

  const step1Form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: { password: '' },
  });

  const handleClose = () => {
    setStep(1);
    setQrCodeDataUrl('');
    step1Form.reset();
    setShowPassword(false);
    setOtpValue('');
    setOtpError('');
    setRecoveryCodes([]);
    setShowRecovery(false);
    onClose();
  };

  const onStep1Submit = (values: Step1Values) => {
    setupMutation.mutate(values.password, {
      onSuccess: (data) => {
        setQrCodeDataUrl(data.qrCodeDataUrl);
        setStep(2);
        setOtpValue('');
        setOtpError('');
      },
      onError: (err) => {
        const code = (err as Error).message;
        if (code === 'wrong_password') {
          step1Form.setError('password', { message: 'Incorrect password' });
        } else {
          toast({
            title: 'Error',
            description: 'Failed to start MFA setup. Please try again.',
            variant: 'destructive',
          });
        }
      },
    });
  };

  const submitOtp = (code: string) => {
    if (code.length !== 6 || confirmMutation.isPending) return;
    setOtpError('');
    confirmMutation.mutate(code, {
      onSuccess: (data) => {
        toast({ title: 'MFA Enabled', description: 'Two-factor authentication is now active.' });
        setRecoveryCodes(data.recoveryCodes);
        setShowRecovery(true);
      },
      onError: (err) => {
        const errCode = (err as Error).message;
        if (errCode === 'totp_invalid') {
          setOtpError('Invalid code. Check your authenticator app and try again.');
        } else {
          toast({
            title: 'Error',
            description: 'Failed to confirm MFA. Please try again.',
            variant: 'destructive',
          });
        }
        setOtpValue('');
      },
    });
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden gap-0">

        {/* ── Shared header ───────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 px-6 pt-6 pb-5">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-gradient-to-b from-gray-400/15 to-transparent" />
            <div className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full bg-background border border-border shadow-sm">
              <Shield className="w-5 h-5 text-muted-foreground" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <h2 className="text-base font-medium text-foreground">
              {step === 1 ? 'Enable Two-Factor Authentication' : 'Set Up Authenticator App'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {step === 1
                ? 'Secure your account with an additional layer of protection.'
                : 'Follow the steps below to complete setup.'}
            </p>
          </div>
        </div>

        <Separator />

        {step === 1 ? (
          // ── Step 1: Password confirmation ────────────────────────────
          <div className="px-6 py-5">
            <Form {...step1Form}>
              <form onSubmit={step1Form.handleSubmit(onStep1Submit)} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  To protect your account, confirm your password to continue.
                </p>
                <FormField
                  control={step1Form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            className="pr-10"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            tabIndex={-1}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={setupMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={setupMutation.isPending}>
                    {setupMutation.isPending ? 'Verifying…' : 'Continue'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        ) : (
          // ── Step 2: QR code + TOTP entry (stepper) ──────────────────
          <div className="px-6 py-5">
            <div className="grid grid-cols-1">
              {STEPS.map((s, index) => (
                <div
                  key={index}
                  className={cn(
                    'relative flex flex-row items-start gap-3',
                    'after:absolute after:top-9 after:bottom-2 after:start-3.5',
                    'after:w-px after:-translate-x-[0.5px] after:bg-border',
                    'last:after:hidden',
                    index !== STEPS.length - 1 && 'pb-5'
                  )}
                >
                  {/* Numbered circle */}
                  <span className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted ring-1 ring-inset ring-border text-xs font-semibold text-foreground">
                    {index + 1}
                  </span>

                  {/* Step content */}
                  <div className="flex flex-col items-start pt-0.5">
                    <p className="text-sm font-semibold leading-5 text-foreground">{s.title}</p>
                    <p className="text-sm leading-5 text-muted-foreground">{s.description}</p>

                    {/* Step 2 — QR code */}
                    {index === 1 && qrCodeDataUrl && (
                      <div className="mt-3 inline-block p-1 border border-border rounded-lg bg-white">
                        <img
                          src={qrCodeDataUrl}
                          alt="TOTP QR Code"
                          className="w-32 h-32"
                        />
                      </div>
                    )}

                    {/* Step 3 — OTP input */}
                    {index === 2 && (
                      <div className="mt-3 space-y-1.5">
                        <InputOTP
                          maxLength={6}
                          value={otpValue}
                          onChange={(val) => {
                            setOtpValue(val);
                            if (otpError) setOtpError('');
                          }}
                          onComplete={submitOtp}
                          disabled={confirmMutation.isPending}
                          autoFocus
                        >
                          <InputOTPGroup className="gap-2.5">
                            <InputOTPSlot index={0} className="rounded-lg border-l h-10 w-10" />
                            <InputOTPSlot index={1} className="rounded-lg border-l h-10 w-10" />
                            <InputOTPSlot index={2} className="rounded-lg border-l h-10 w-10" />
                            <InputOTPSlot index={3} className="rounded-lg border-l h-10 w-10" />
                            <InputOTPSlot index={4} className="rounded-lg border-l h-10 w-10" />
                            <InputOTPSlot index={5} className="rounded-lg border-l h-10 w-10" />
                          </InputOTPGroup>
                        </InputOTP>
                        {otpError && (
                          <p className="text-xs text-red-600">{otpError}</p>
                        )}
                        {confirmMutation.isPending && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Verifying…
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-border flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setStep(1); setOtpValue(''); setOtpError(''); }}
                disabled={confirmMutation.isPending}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={() => submitOtp(otpValue)}
                disabled={confirmMutation.isPending || otpValue.length < 6}
              >
                {confirmMutation.isPending ? (
                  'Activating…'
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Activate MFA
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Recovery codes shown immediately after MFA is confirmed */}
    <RecoveryCodesModal
      open={showRecovery}
      codes={recoveryCodes}
      onClose={handleClose}
    />
    </>
  );
}
