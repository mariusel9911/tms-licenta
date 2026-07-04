import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, KeyRound, Loader2, Shield, TriangleAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AnimatedThemeToggle } from '@/components/ui/animated-theme-toggle';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuthStore } from '@/store/auth.store';
import { getPasskeyAuthenticationOptionsApi, verifyMfaApi } from '@/api/auth.api';
import { FloatingPaths } from '@/components/ui/background-paths';
import { startAuthentication } from '@simplewebauthn/browser';

export default function TwoFactorWebAuthnPage() {
  useEffect(() => { document.title = 'Passkey'; }, []);
  const navigate = useNavigate();
  const { mfaPendingToken, mfaMethods, login, setMfaPending } = useAuthStore();
  const [isDark, setIsDark] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMore, setShowMore] = useState(false);

  if (!mfaPendingToken) {
    return <Navigate to="/login" replace />;
  }

  const handlePasskey = async () => {
    setIsLoading(true);
    setError('');
    try {
      const options = await getPasskeyAuthenticationOptionsApi(mfaPendingToken);
      const response = await startAuthentication({
        optionsJSON: options as unknown as Parameters<typeof startAuthentication>[0]['optionsJSON'],
      });
      const result = await verifyMfaApi(mfaPendingToken, {
        webauthnResponse: response as unknown as Record<string, unknown>,
      });
      login(result.token, result.user);
      navigate('/orders', { replace: true });
    } catch (err) {
      const error = err as Error;
      if (error.name === 'NotAllowedError') {
        setError('Authentication failed.');
      } else if (error.message === 'webauthn_invalid') {
        setError('Passkey verification failed. Please try again.');
      } else if (error.message === 'mfa_token_invalid') {
        setError('Session expired. Please go back and sign in again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setMfaPending(null, null);
    navigate('/login', { replace: true });
  };

  const otherMethods = (mfaMethods ?? []).filter((m) => m !== 'passkey');

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
            <CardDescription>Authenticate using your passkey.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
              <TriangleAlert className="h-4 w-4 shrink-0 text-red-600" />
              {error}
            </div>
          )}

          <Button
            className="w-full"
            onClick={() => void handlePasskey()}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              <>
                <KeyRound className="mr-2 h-4 w-4" />
                Use passkey
              </>
            )}
          </Button>

          {/* More options collapsible */}
          {otherMethods.length > 0 && (
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
                      {otherMethods.includes('totp') && (
                        <button
                          type="button"
                          onClick={() => navigate('/login/two-factor/totp', { replace: true })}
                          className="w-full py-2.5 px-4 text-sm font-medium border rounded-md hover:bg-gray-50 transition-colors"
                        >
                          Authenticator app
                        </button>
                      )}
                      {otherMethods.includes('recovery_code') && (
                        <button
                          type="button"
                          onClick={() => navigate('/login/two-factor/recovery', { replace: true })}
                          className="w-full py-2.5 px-4 text-sm font-medium text-red-600 border rounded-md hover:bg-gray-50 transition-colors"
                        >
                          Recovery code
                        </button>
                      )}
                      {otherMethods.includes('email_otp') && (
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
            disabled={isLoading}
          >
            ← Back to sign in
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
