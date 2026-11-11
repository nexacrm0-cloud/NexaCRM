'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock3 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { formatDemoRemaining, getDemoRemainingMs } from '@nexa/shared';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Banner shown to prospects inside a time-boxed sales demo: it always states
 * how much demo time is left so the week is felt as a deadline, not as an
 * unlimited trial.
 */
export function DemoBanner() {
  const { user } = useAuth();
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((tick) => tick + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  if (!user?.isDemo || !user.demoExpiresAt) return null;

  const remainingMs = getDemoRemainingMs({
    isDemo: true,
    demoExpiresAt: user.demoExpiresAt,
  });
  const remaining = formatDemoRemaining(remainingMs);
  const urgent = remainingMs > 0 && remainingMs < ONE_DAY_MS;
  const expiresAt = new Date(user.demoExpiresAt).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-2.5 md:px-7 ${
        urgent ? 'border-alizarin/40 bg-alizarin/10' : 'border-naranja/40 bg-naranja/10'
      }`}
      role="status"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Clock3
          className={`h-4 w-4 shrink-0 ${urgent ? 'text-alizarin' : 'text-naranja'}`}
          strokeWidth={1.6}
        />
        <p className="text-ink-2 truncate text-sm">
          <span className="font-semibold">Demo de 7 días</span>
          <span className="text-ink-3"> · te queda </span>
          <span className={`tabular font-semibold ${urgent ? 'text-alizarin' : 'text-naranja'}`}>
            {remaining}
          </span>
          <span className="text-ink-3"> · vence el {expiresAt}</span>
        </p>
      </div>

      <Link
        href="/pricing"
        className={`eyebrow shrink-0 border px-3 py-1.5 transition-colors ${
          urgent
            ? 'border-alizarin/50 text-alizarin hover:bg-alizarin/10'
            : 'border-naranja/50 text-naranja hover:bg-naranja/10'
        }`}
      >
        Activar mi plan
      </Link>
    </div>
  );
}
