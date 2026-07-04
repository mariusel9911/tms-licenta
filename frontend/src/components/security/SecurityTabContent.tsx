import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Mail, Smartphone, Shield, RefreshCw, KeyRound, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { MfaSetupModal } from './MfaSetupModal';
import { MfaDisableModal } from './MfaDisableModal';
import { RecoveryCodesModal } from './RecoveryCodesModal';
import { PasskeysList } from './PasskeysList';
import { PasskeySetupModal } from './PasskeySetupModal';
import { EmailOtpDisableModal } from './EmailOtpDisableModal';
import { useMfaStatus, useRecoveryCodeCount, useRegenerateRecoveryCodes, useToggleEmailOtp } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/use-toast';

const regenerateSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});
type RegenerateFormValues = z.infer<typeof regenerateSchema>;

export function SecurityTabContent() {
  const { toast } = useToast();
  const { data: mfaStatus, isLoading } = useMfaStatus();
  const { data: countData } = useRecoveryCodeCount();
  const { data: settings } = useSettings();
  const regenerateMutation = useRegenerateRecoveryCodes();
  const toggleEmailOtpMutation = useToggleEmailOtp();

  const smtpAvailable = !!(settings?.smtpEnabled && settings.smtpHost && settings.smtpEmail);
  const emailOtpEnabled = mfaStatus?.emailOtpEnabled ?? false;

  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [emailOtpDisableOpen, setEmailOtpDisableOpen] = useState(false);
  const [passkeySetupOpen, setPasskeySetupOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [showNewCodes, setShowNewCodes] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isEnabled = mfaStatus?.totpEnabled ?? false;
  const remaining = countData?.remaining ?? 0;
  const isLow = isEnabled && remaining <= 2;

  const regenerateForm = useForm<RegenerateFormValues>({
    resolver: zodResolver(regenerateSchema),
    defaultValues: { password: '' },
  });

  const handleRegenerateClose = () => {
    regenerateForm.reset();
    setShowPassword(false);
    setRegenerateOpen(false);
  };

  const onRegenerateSubmit = (values: RegenerateFormValues) => {
    regenerateMutation.mutate(values.password, {
      onSuccess: (data) => {
        setNewCodes(data.recoveryCodes);
        handleRegenerateClose();
        setShowNewCodes(true);
      },
      onError: (err) => {
        const code = (err as Error).message;
        if (code === 'wrong_password') {
          regenerateForm.setError('password', { message: 'Incorrect password' });
        } else {
          toast({
            title: 'Error',
            description: 'Failed to regenerate codes. Please try again.',
            variant: 'destructive',
          });
        }
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Section header card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 shrink-0">
            <Shield className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Security</h2>
            <p className="text-sm text-gray-500">
              Manage two-factor authentication and other account security settings.
            </p>
          </div>
        </div>
      </div>

      {/* MFA card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <p className="text-sm font-semibold text-gray-800 mb-4">Multi-Factor Authentication (MFA)</p>

        <div className="flex items-center justify-between py-3">
          {/* Left: icon + description */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 shrink-0">
              <Smartphone className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Mobile Authenticator App</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Use an app like Google Authenticator or Authy to generate time-based codes.
              </p>
            </div>
          </div>

          {/* Right: toggle switch */}
          <div className="flex items-center gap-3 ml-4 shrink-0">
            {isLoading ? (
              <div className="h-6 w-11 bg-gray-100 rounded-full animate-pulse" />
            ) : (
              <button
                type="button"
                role="switch"
                aria-checked={isEnabled}
                onClick={() => isEnabled ? setDisableOpen(true) : setSetupOpen(true)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${isEnabled ? 'bg-green-600' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            )}
          </div>
        </div>

        {/* Recovery codes row — shown only when TOTP is enabled */}
        {isEnabled && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {remaining} recovery code{remaining !== 1 ? 's' : ''} remaining
              </span>
              {isLow && (
                <Badge
                  variant="outline"
                  className="bg-amber-50 text-amber-700 border-amber-200 text-xs font-medium"
                >
                  Low — regenerate soon
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-gray-600 h-7 gap-1.5 active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
              onClick={() => setRegenerateOpen(true)}
            >
              <RefreshCw className="w-3 h-3" />
              Regenerate codes
            </Button>
          </div>
        )}

        {/* Passkeys section — inside the same MFA card */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          {/* Header row — same layout as Mobile Authenticator App row */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 shrink-0">
                <KeyRound className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Passkeys / Security Keys</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Register hardware keys or biometric authenticators (Touch ID, Windows Hello, YubiKey)
                  as a phishing-resistant second factor.
                </p>
              </div>
            </div>
            <div className="ml-4 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPasskeySetupOpen(true)}
                className="active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
              >
                <Plus className="w-3.5 h-3.5" />
                Register Passkey
              </Button>
            </div>
          </div>
          <PasskeysList />
        </div>

        {/* Email OTP row */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-50 shrink-0">
                <Mail className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Email OTP</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {smtpAvailable
                    ? 'Receive a one-time code by email as a fallback 2FA method.'
                    : 'Requires SMTP to be configured in the Integrations tab.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 ml-4 shrink-0">
              {isLoading ? (
                <div className="h-6 w-11 bg-gray-100 rounded-full animate-pulse" />
              ) : !smtpAvailable ? (
                <Badge
                  variant="outline"
                  className="bg-gray-50 text-gray-500 border-gray-200 text-xs font-medium"
                >
                  SMTP not configured
                </Badge>
              ) : (
                <button
                  type="button"
                  role="switch"
                  aria-checked={emailOtpEnabled}
                  disabled={toggleEmailOtpMutation.isPending}
                  onClick={() => emailOtpEnabled ? setEmailOtpDisableOpen(true) : toggleEmailOtpMutation.mutate({ enable: true })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 ${emailOtpEnabled ? 'bg-green-600' : 'bg-gray-200'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${emailOtpEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <MfaSetupModal open={setupOpen} onClose={() => setSetupOpen(false)} />
      <MfaDisableModal open={disableOpen} onClose={() => setDisableOpen(false)} />
      <PasskeySetupModal open={passkeySetupOpen} onClose={() => setPasskeySetupOpen(false)} />
      <EmailOtpDisableModal open={emailOtpDisableOpen} onClose={() => setEmailOtpDisableOpen(false)} />

      {/* Regenerate codes — password confirm dialog */}
      <Dialog open={regenerateOpen} onOpenChange={(v) => { if (!v) handleRegenerateClose(); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-gray-600" />
              Regenerate Recovery Codes
            </DialogTitle>
          </DialogHeader>

          <Form {...regenerateForm}>
            <form onSubmit={regenerateForm.handleSubmit(onRegenerateSubmit)} className="space-y-4">
              <p className="text-sm text-gray-600">
                This will invalidate your existing codes and generate 10 new ones. Enter your
                password to confirm.
              </p>

              <FormField
                control={regenerateForm.control}
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
                  onClick={handleRegenerateClose}
                  disabled={regenerateMutation.isPending}
                  className="active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={regenerateMutation.isPending}
                  className="active:scale-[0.97] transition-[transform,background-color] duration-150 ease-out-expo"
                >
                  {regenerateMutation.isPending ? 'Generating…' : 'Generate New Codes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Show new codes after regeneration */}
      <RecoveryCodesModal
        open={showNewCodes}
        codes={newCodes}
        onClose={() => { setNewCodes([]); setShowNewCodes(false); }}
      />
    </div>
  );
}
