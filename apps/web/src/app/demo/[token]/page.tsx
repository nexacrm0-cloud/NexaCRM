'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import { API_BASE } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { AuthShell } from '@/components/auth/auth-shell';

/**
 * One-click demo link.
 *
 * The sales team mints a link per prospect (`POST /demo/access`). Opening it
 * exchanges the signed token for a regular session — the prospect never types
 * a password — and drops them straight on the dashboard with their own,
 * isolated demo data.
 */
export default function DemoAccessPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { adoptSession } = useAuth();
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    // React 18 StrictMode mounts effects twice in dev: the exchange must run
    // only once, otherwise the second call would invalidate the session.
    if (started.current) return;
    started.current = true;

    const token = params?.token;
    if (!token) {
      setError('El link de demo no es válido.');
      return;
    }

    (async () => {
      try {
        // NOTE: a raw fetch (not `api.get`) on purpose: `api.get` treats a
        // 401 as "the session expired" and would bounce the prospect to the
        // login form. An expired demo LINK must explain itself on this page.
        const response = await fetch(`${API_BASE}/demo/session/${encodeURIComponent(token)}`, {
          credentials: 'include',
        });

        const body = await response.json().catch(() => null);

        if (!response.ok) {
          setError(
            body?.error?.message ?? 'Tu demo de 7 días ya no está disponible. Pedinos una nueva.',
          );
          return;
        }

        adoptSession({
          accessToken: body?.data?.accessToken,
          user: body?.data?.user,
        });
        router.replace('/dashboard');
      } catch {
        setError('No pudimos abrir tu demo. Revisá tu conexión e intentá de nuevo.');
      }
    })();
  }, [params, router, adoptSession]);

  if (error) {
    return (
      <AuthShell eyebrow="Demo Nexa" title="Tu demo ya no está disponible">
        <p className="text-ink-3 text-sm">{error}</p>
        <Button className="mt-6 w-full" onClick={() => router.push('/login')}>
          Ir al login
        </Button>
        <p className="eyebrow text-ink-3 mt-4 text-center">
          ¿Querés una demo nueva? Escribinos y te la activamos al toque.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="Demo Nexa" title="Preparando tu demo…">
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <Loader2 className="text-ink-3 h-6 w-6 animate-spin" strokeWidth={1.5} />
        <p className="text-ink-3 text-sm">
          Estamos cargando tus datos de prueba. Esto toma un segundo.
        </p>
        <p className="eyebrow text-ink-3 flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
          Sesión aislada: sólo vos ves estos datos
        </p>
      </div>
    </AuthShell>
  );
}
