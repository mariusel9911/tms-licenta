import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Loader2, Shield, TriangleAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AnimatedThemeToggle } from '@/components/ui/animated-theme-toggle';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuthStore } from '@/store/auth.store';
import { verifyMfaApi } from '@/api/auth.api';
import { FloatingPaths } from '@/components/ui/background-paths';

export default function TwoFactorRecoveryPage() {
  useEffect(() => { document.title = 'Two-factor recovery - TMS'; }, []);
  const navigate = useNavigate();
  const { mfaPendingToken, mfaMethods, login, setMfaPending } = useAuthStore();
  const [isDark, setIsDark] = useState(true);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showMore, setShowMore] = useState(false);

  if (!mfaPendingToken) {
    return <Navigate to="/login" replace />;
  }

  const submitRecoveryCode = async () => {
    if (!mfaPendingToken || !recoveryCode.trim() || isVerifying) return;
    setIsVerifying(true);
    setError('');
    try {
      const result = await verifyMfaApi(mfaPendingToken, { recoveryCode: recoveryCode.trim() });
      login(result.token, result.user);
      navigate('/orders', { replace: true });
    } catch (err) {
      const errorCode = err instanceof Error ? err.message : 'unknown';
      if (errorCode === 'recovery_code_invalid') {
        setError('Invalid or already-used recovery code.');
      } else if (errorCode === 'mfa_token_invalid') {
        setError('Session expired. Please go back and sign in again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
      setRecoveryCode('');
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
            <CardTitle className="text-2xl font-bold">Two-factor recovery</CardTitle>
            <CardDescription className="text-sm text-gray-500">
              If you are unable to access your device or cannot receive a two-factor authentication code,
              enter one of your recovery codes to verify your identity.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
              <TriangleAlert className="h-4 w-4 shrink-0 text-red-600" />
              {error}
            </div>
          )}

          <Input
            value={recoveryCode}
            onChange={(e) => {
              setRecoveryCode(e.target.value);
              if (error) setError('');
            }}
            placeholder="XXXXX-XXXXX"
            className="font-mono text-center tracking-widest"
            autoFocus
            disabled={isVerifying}
            onKeyDown={(e) => { if (e.key === 'Enter') void submitRecoveryCode(); }}
          />

          <Button
            className="w-full"
            onClick={() => void submitRecoveryCode()}
            disabled={isVerifying || !recoveryCode.trim()}
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify'
            )}
          </Button>

          {/* More options collapsible */}
          {(hasPasskey || hasTotp || hasEmailOtp) && (
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
