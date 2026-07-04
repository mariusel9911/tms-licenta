import { lazy, Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Navigate } from 'react-router-dom';
import { KeyRound, Loader2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedThemeToggle } from '@/components/ui/animated-theme-toggle';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuthStore } from '@/store/auth.store';
import { loginApi, getPasskeyLoginOptionsApi, verifyPasskeyLoginApi, type LoginApiError } from '@/api/auth.api';
import { startAuthentication } from '@simplewebauthn/browser';

// Progressive enhancement: background loads after login form renders
const FloatingPaths = lazy(() =>
  import('@/components/ui/background-paths').then(m => ({ default: m.FloatingPaths }))
);

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type LoginFormValues = z.infer<typeof loginSchema>;

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function LoginPage() {
  useEffect(() => { document.title = 'Login - TMS'; }, []);
  const navigate = useNavigate();
  const { token, login, setMfaPending } = useAuthStore();
  const [isDark, setIsDark] = useState(true);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (token) {
    return <Navigate to="/orders" replace />;
  }

  // Step 1: email + password
  const onLoginSubmit = async (values: LoginFormValues) => {
    setAuthError('');
    try {
      const result = await loginApi(values.email, values.password);

      if ('mfaRequired' in result) {
        // Store MFA state and navigate to the appropriate 2FA page
        setMfaPending(result.mfaToken, result.methods, result.maskedEmail);
        const firstMethod = result.methods[0];
        if (firstMethod === 'passkey') {
          navigate('/login/two-factor/webauthn', { replace: true });
        } else {
          navigate('/login/two-factor/totp', { replace: true });
        }
      } else {
        login(result.token, result.user);
        navigate('/orders', { replace: true });
      }
    } catch (err) {
      const apiErr = err as LoginApiError;
      if (apiErr.code === 'account_locked') {
        setAuthError(`Account locked. Try again in ${apiErr.remainingMin ?? 15} minute(s).`);
      } else if (apiErr.code === 'invalid_credentials') {
        setAuthError('Invalid email or password.');
      } else {
        setAuthError('Something went wrong. Please try again.');
      }
    }
  };

  // Standalone passkey login (no credentials required)
  const handlePasskeyLogin = async () => {
    setIsPasskeyLoading(true);
    setAuthError('');
    try {
      const { options, passkeyLoginToken } = await getPasskeyLoginOptionsApi();
      const response = await startAuthentication({
        optionsJSON: options as unknown as Parameters<typeof startAuthentication>[0]['optionsJSON'],
      });
      const result = await verifyPasskeyLoginApi(
        response as unknown as Record<string, unknown>,
        passkeyLoginToken,
      );
      login(result.token, result.user);
      navigate('/orders', { replace: true });
    } catch (err) {
      const error = err as Error;
      if (error.name === 'NotAllowedError') {
        setAuthError('Authentication failed.');
      } else if (error.message === 'webauthn_invalid') {
        setAuthError('Passkey verification failed. Please try again.');
      } else if (error.message === 'passkey_challenge_expired') {
        setAuthError('Session expired. Please try again.');
      } else {
        setAuthError('Something went wrong. Please try again.');
      }
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center relative overflow-hidden ${isDark ? 'bg-neutral-950' : 'bg-white'}`}>
      {!prefersReducedMotion && (
        <Suspense fallback={null}>
          <FloatingPaths position={1} dark={isDark} />
          <FloatingPaths position={-1} dark={isDark} />
        </Suspense>
      )}
      <AnimatedThemeToggle
        isDark={isDark}
        onToggle={() => setIsDark((d) => !d)}
        className="absolute top-4 right-4 z-20"
      />
      <Card className="w-full max-w-sm relative z-10">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">TMS</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
              <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="hello@tms.ro"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {authError && (
                <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
                  <TriangleAlert className="h-4 w-4 shrink-0 text-red-600" />
                  {authError}
                </div>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={loginForm.formState.isSubmitting || isPasskeyLoading}
              >
                {loginForm.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          </Form>

          {/* Passkey login alternative */}
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => void handlePasskeyLogin()}
              disabled={isPasskeyLoading || loginForm.formState.isSubmitting}
              className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 disabled:opacity-50 transition-colors"
            >
              {isPasskeyLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <KeyRound className="h-3.5 w-3.5" />
              )}
              Use a passkey instead
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
