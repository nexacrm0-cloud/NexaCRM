'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { Loader2, KeyRound, Mail } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell } from '@/components/auth/auth-shell';

type Mode = 'password' | 'otp';

export default function LoginPage() {
  const { login, loginWithOtp, requestOtp } = useAuth();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  // SECURITY D6: turn the CAPTCHA widget on after the first failed login.
  // The server decides authoritatively; the client just stops bouncing the
  // user back with 401s by surfacing the challenge up front.
  const [showCaptcha, setShowCaptcha] = useState(false);
  const captchaTokenRef = useRef<string | undefined>(undefined);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const onPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await login(email, password, captchaTokenRef.current);
      // Reset captcha state on success.
      setShowCaptcha(false);
      captchaTokenRef.current = undefined;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      // SECURITY D6: after the first failure, surface the CAPTCHA widget.
      // The server only enforces it past the threshold, but presenting it
      // proactively reduces wasted round-trips for the user.
      setShowCaptcha(true);
    } finally {
      setLoading(false);
    }
  };

  const onSendCode = async () => {
    setError('');
    setInfo('');
    if (!email) {
      setError('Ingresá tu email primero');
      return;
    }
    setLoading(true);
    try {
      await requestOtp(email, 'login');
      setInfo('Te enviamos un código de 6 dígitos a tu casilla.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos enviarte el código');
    } finally {
      setLoading(false);
    }
  };

  const onOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setError('El código tiene 6 dígitos');
      return;
    }
    setLoading(true);
    try {
      await loginWithOtp(email, otpCode.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido o expirado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Iniciar sesión" subtitle="Tus credenciales del CRM.">
      <div className="border-ink/14 mb-6 grid grid-cols-2 border">
        <button
          type="button"
          onClick={() => setMode('password')}
          className={`eyebrow px-3 py-2.5 transition-colors ${
            mode === 'password' ? 'bg-ink text-paper-1' : 'bg-paper-1 text-ink-3'
          }`}
        >
          Contraseña
        </button>
        <button
          type="button"
          onClick={() => setMode('otp')}
          className={`eyebrow border-ink/14 border-l px-3 py-2.5 transition-colors ${
            mode === 'otp' ? 'bg-ink text-paper-1' : 'bg-paper-1 text-ink-3'
          }`}
        >
          Código por email
        </button>
      </div>

      {error && (
        <div className="border-alizarin/40 bg-alizarin/10 eyebrow text-alizarin mb-4 border px-3 py-2">
          {error}
        </div>
      )}
      {info && (
        <div className="border-cobalt/40 bg-cobalt/10 eyebrow text-cobalt mb-4 border px-3 py-2">
          {info}
        </div>
      )}

      {mode === 'password' ? (
        <form onSubmit={onPasswordSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="eyebrow">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="eyebrow">
              Contraseña
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {/* SECURITY D6: Turnstile widget renders only after a failure so
              first-time legitimate users see no friction. Token is captured
              via ref and forwarded to /auth/login. If NEXT_PUBLIC_TURNSTILE_SITE_KEY
              is unset (dev), the widget is silently skipped — the server
              then enforces CAPTCHA in prod-only via TURNSTILE_SECRET_KEY. */}
          {showCaptcha && turnstileSiteKey && (
            <div className="flex justify-center">
              <Turnstile
                siteKey={turnstileSiteKey}
                onSuccess={(token) => {
                  captchaTokenRef.current = token;
                }}
                onError={() => {
                  captchaTokenRef.current = undefined;
                }}
                onExpire={() => {
                  captchaTokenRef.current = undefined;
                }}
                options={{ theme: 'light', size: 'flexible' }}
              />
            </div>
          )}
          <Button type="submit" variant="ink" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Iniciando sesión…
              </>
            ) : (
              <>
                <KeyRound className="mr-2 h-3.5 w-3.5" />
                Iniciar sesión
              </>
            )}
          </Button>
        </form>
      ) : (
        <form onSubmit={onOtpSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp-email" className="eyebrow">
              Email
            </Label>
            <Input
              id="otp-email"
              type="email"
              placeholder="tu@email.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onSendCode}
            disabled={loading || !email}
          >
            {loading ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Mail className="mr-2 h-3.5 w-3.5" />
            )}
            Enviarme un código
          </Button>

          <div className="space-y-2">
            <Label htmlFor="otp-code" className="eyebrow">
              Código de 6 dígitos
            </Label>
            <Input
              id="otp-code"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              className="text-center font-mono text-lg tracking-widest"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
            />
          </div>

          <Button
            type="submit"
            variant="ink"
            className="w-full"
            disabled={loading || otpCode.length !== 6}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Verificando…
              </>
            ) : (
              <>
                <KeyRound className="mr-2 h-3.5 w-3.5" />
                Ingresar con código
              </>
            )}
          </Button>
        </form>
      )}

      <div className="border-ink/14 mt-6 space-y-2 border-t pt-4">
        <p className="text-center text-sm">
          <Link
            href="/forgot-password"
            className="text-ink-3 hover:text-ink underline-offset-2 hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </p>
        <p className="eyebrow text-ink-3 border-ink/14 border-t pt-2 text-center">
          ¿No tenés cuenta?{' '}
          <Link href="/register" className="text-naranja hover:underline">
            Registrarme
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
