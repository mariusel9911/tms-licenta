import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Loader2, Mail, TriangleAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AnimatedThemeToggle } from '@/components/ui/animated-theme-toggle';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp';
import { useAuthStore } from '@/store/auth.store';
import { requestEmailOtpApi, verifyMfaApi } from '@/api/auth.api';
import { FloatingPaths } from '@/components/ui/background-paths';

const RESEND_COOLDOWN_S = 60;

export default function TwoFactorEmailOtpPage() {
  useEffect(() => { document.title = 'Email verification - TMS'; }, []);
  const navigate = useNavigate();
  const { mfaPendingToken, mfaMethods, mfaMaskedEmail, login, setMfaPending } = useAuthStore();
  const [isDark, setIsDark] = useState(true);
  const [otpValue, setOtpValue] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [showMore, setShowMore] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  if (!mfaPendingToken) {
    return <Navigate to="/login" replace />;
  }

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_S);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleSendCode = async () => {
    if (!mfaPendingToken || isSending || cooldown > 0) return;
    setIsSending(true);
    setError('');
    try {
      const result = await requestEmailOtpApi(mfaPendingToken);
      setCodeSent(true);
      setExpiresAt(new Date(result.expiresAt));
      startCooldown();
    } catch (err) {
      const code = err instanceof Error ? err.message : 'unknown';
      if (code === 'mfa_token_invalid') {
        setError('Session expired. Please go back and sign in again.');
      } else if (code === 'smtp_not_configured') {
        setError('Email is not configured. Please contact your administrator.');
      } else {
        setError('Failed to send code. Please try again.');
      }
    } finally {
      setIsSending(false);
    }
  };

  const submitOtp = async (code: string) => {
    if (!mfaPendingToken || code.length !== 6 || isVerifying) return;
    setIsVerifying(true);
    setError('');
    try {
      const result = await verifyMfaApi(mfaPendingToken, { emailOtpCode: code });
      login(result.token, result.user);
      navigate('/orders', { replace: true });
    } catch (err) {
      const errorCode = err instanceof Error ? err.message : 'unknown';
      if (errorCode === 'email_otp_invalid') {
        setError('Invalid or expired code. Please try again.');
      } else if (errorCode === 'mfa_token_invalid') {
        setError('Session expired. Please go back and sign in again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
      setOtpValue('');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBack = () => {
    setMfaPending(null, null);
    navigate('/login', { replace: true });
  };

  const methods = mfaMethods ?? [];
  const hasPasskey = methods.includes('passkey');
  const hasTotp = methods.includes('totp');
  const hasRecovery = methods.includes('recovery_code');
  const hasAlternatives = hasPasskey || hasTotp || hasRecovery;

  const minutesLeft = expiresAt
    ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 60000))
    : 0;

  return (
    <div className={`min-h-screen flex items-center justify-center relative overflow-hidden ${isDark ? 'bg-neutral-950' : 'bg-white'}`}>
      <FloatingPaths position={1} dark={isDark} />
      <FloatingPaths position={-1} dark={isDark} />
      <AnimatedThemeToggle
        isDark={isDark}
        onToggle={() => setIsDark((d) => !d)}
        className="absolute top-4 right-4 z-20"
      />
      <Card className="w-full max-w-md relative z-10">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
              <Mail className="h-7 w-7 text-blue-600" />
            </div>
          </div>
          <div className="space-y-1.5">
            <CardTitle className="text-2xl font-bold">Email verification</CardTitle>
            <CardDescription>
              {mfaMaskedEmail
                ? `We'll send a 6-digit code to ${mfaMaskedEmail}`
                : 'We\'ll send a 6-digit code to your registered email address'}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
              <TriangleAlert className="h-4 w-4 shrink-0 text-red-600" />
              {error}
            </div>
          )}

          {/* Send code button */}
          {!codeSent ? (
            <Button
              className="w-full"
              onClick={() => void handleSendCode()}
              disabled={isSending}
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send code'
              )}
            </Button>
          ) : (
            <>
              <div className="text-center text-sm text-gray-500">
                Code sent
                {expiresAt && minutesLeft > 0 && ` — expires in ${minutesLeft} min`}
              </div>

              <div className="flex flex-col items-center gap-3">
                <p className="text-sm font-medium text-gray-700">Verification Code</p>
                <InputOTP
                  maxLength={6}
                  value={otpValue}
                  onChange={(val) => {
                    setOtpValue(val);
                    if (error) setError('');
                  }}
                  onComplete={submitOtp}
                  disabled={isVerifying}
                  autoFocus
                >
                  <InputOTPGroup className="gap-2">
                    <InputOTPSlot index={0} className="rounded-md border-l h-12 w-12 text-base" />
                    <InputOTPSlot index={1} className="rounded-md border-l h-12 w-12 text-base" />
                    <InputOTPSlot index={2} className="rounded-md border-l h-12 w-12 text-base" />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup className="gap-2">
                    <InputOTPSlot index={3} className="rounded-md border-l h-12 w-12 text-base" />
                    <InputOTPSlot index={4} className="rounded-md border-l h-12 w-12 text-base" />
                    <InputOTPSlot index={5} className="rounded-md border-l h-12 w-12 text-base" />
                  </InputOTPGroup>
                </InputOTP>
                {isVerifying && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying...
                  </div>
                )}
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => void handleSendCode()}
                  disabled={isSending || cooldown > 0}
                  className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
            </>
          )}

          {/* More options collapsible */}
          {hasAlternatives && (
            <>
              <button
                type="button"
                onClick={() => setShowMore((v) => !v)}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-medium border rounded-md hover:bg-gray-50 transition-colors"
              >
                More options
                {showMore ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              <AnimatePresence>
                {showMore && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2">
                      {hasPasskey && (
                        <button
                          type="button"
                          onClick={() => navigate('/login/two-factor/webauthn', { replace: true })}
                          className="w-full py-2.5 px-4 text-sm font-medium border rounded-md hover:bg-gray-50 transition-colors"
                        >
                          Passkey
                        </button>
                      )}
                      {hasTotp && (
                        <button
                          type="button"
                          onClick={() => navigate('/login/two-factor/totp', { replace: true })}
                          className="w-full py-2.5 px-4 text-sm font-medium border rounded-md hover:bg-gray-50 transition-colors"
                        >
                          Authenticator app
                        </button>
                      )}
                      {hasRecovery && (
                        <button
                          type="button"
                          onClick={() => navigate('/login/two-factor/recovery', { replace: true })}
                          className="w-full py-2.5 px-4 text-sm font-medium text-red-600 border rounded-md hover:bg-gray-50 transition-colors"
                        >
                          Recovery code
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          <Button
            type="button"
            variant="ghost"
            className="w-full flex items-center justify-center gap-2 text-sm text-gray-500"
            onClick={handleBack}
            disabled={isVerifying || isSending}
          >
            ← Back to sign in
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
