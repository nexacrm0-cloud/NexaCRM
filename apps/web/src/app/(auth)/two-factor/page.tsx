'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell } from '@/components/auth/auth-shell';
import { Loader2 } from 'lucide-react';

function TwoFactorForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const storedUserId = sessionStorage.getItem('2fa_user_id');
    if (!storedUserId) {
      router.push('/login');
      return;
    }
    setUserId(storedUserId);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || code.length !== 6) return;

    setIsSubmitting(true);
    setError('');

    try {
      const response = await api.post<{
        success: boolean;
        data: { user: any; accessToken: string };
      }>('/auth/2fa/complete-login', { userId, token: code });

      if (response.success) {
        api.setAccessToken(response.data.accessToken);
        sessionStorage.removeItem('2fa_user_id');
        window.location.href = '/dashboard';
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Código inválido');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Verificación en dos pasos"
      subtitle="Ingresá el código de tu app autenticadora."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="border-alizarin/40 bg-alizarin/10 eyebrow text-alizarin border px-3 py-2">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="code" className="eyebrow">
            Código de 6 dígitos
          </Label>
          <Input
            id="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            className="tabular text-center font-mono text-[22px] tracking-[0.4em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            autoComplete="one-time-code"
            autoFocus
          />
        </div>

        <Button
          type="submit"
          variant="ink"
          className="w-full"
          disabled={isSubmitting || code.length !== 6}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Verificando…
            </>
          ) : (
            'Verificar'
          )}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function TwoFactorPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Verificación en dos pasos">
          <div className="flex justify-center py-6">
            <Loader2 className="text-cobalt h-6 w-6 animate-spin" />
          </div>
        </AuthShell>
      }
    >
      <TwoFactorForm />
    </Suspense>
  );
}
