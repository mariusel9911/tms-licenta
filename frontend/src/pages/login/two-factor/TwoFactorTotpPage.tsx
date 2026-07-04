import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Loader2, Shield, TriangleAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AnimatedThemeToggle } from '@/components/ui/animated-theme-toggle';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@/components/ui/input-otp';
import { useAuthStore } from '@/store/auth.store';
import { verifyMfaApi } from '@/api/auth.api';
import { FloatingPaths } from '@/components/ui/background-paths';

export default function TwoFactorTotpPage() {
  useEffect(() => { document.title = 'TOTP'; }, []);
  const navigate = useNavigate();
  const { mfaPendingToken, mfaMethods, login, setMfaPending } = useAuthStore();
  const [isDark, setIsDark] = useState(true);
  const [otpValue, setOtpValue] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showMore, setShowMore] = useState(false);

  if (!mfaPendingToken) {
    return <Navigate to="/login" replace />;
  }

  const submitOtp = async (code: string) => {
    if (!mfaPendingToken || code.length !== 6 || isVerifying) return;
    setIsVerifying(true);
    setError('');
    try {
      const result = await verifyMfaApi(mfaPendingToken, { totpCode: code });
      login(result.token, result.user);
      navigate('/orders', { replace: true });
    } catch (err) {
      const errorCode = err instanceof Error ? err.message : 'unknown';
      if (errorCode === 'totp_invalid') {
        setError('Invalid code. Check your authenticator app and try again.');
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
  const hasRecovery = methods.includes('recovery_code');
  const hasEmailOtp = methods.includes('email_otp');

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
              <Shield className="h-7 w-7 text-blue-600" />
            </div>
          </div>
          <div className="space-y-1.5">
            <CardTitle className="text-2xl font-bold">Two-factor authentication</CardTitle>
            <CardDescription>Enter the 6-digit code from your authenticator app</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
              <TriangleAlert className="h-4 w-4 shrink-0 text-red-600" />
              {error}
            </div>
          )}

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

          {/* More options collapsible */}
          {(hasPasskey || hasRecovery || hasEmailOtp) && (
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
                      {hasRecovery && (
                        <button
                          type="button"
                          onClick={() => navigate('/login/two-factor/recovery', { replace: true })}
                          className="w-full py-2.5 px-4 text-sm font-medium text-red-600 border rounded-md hover:bg-gray-50 transition-colors"
                        >
                          Recovery code
                        </button>
                      )}
                      {hasEmailOtp && (
                        <button
                          type="button"
                          onClick={() => navigate('/login/two-factor/email-otp', { replace: true })}
                          className="w-full py-2.5 px-4 text-sm font-medium border rounded-md hover:bg-gray-50 transition-colors"
                        >
                          Email me a code
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
            disabled={isVerifying}
          >
            ← Back to sign in
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
