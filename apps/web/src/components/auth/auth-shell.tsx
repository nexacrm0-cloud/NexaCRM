import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { ReactNode } from 'react';

interface AuthShellProps {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  className,
}: AuthShellProps) {
  return (
    <div
      className={cn('bg-paper flex min-h-screen items-center justify-center px-5 py-10', className)}
    >
      <div className="fade-up w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-6 inline-flex items-center gap-2">
            <span className="numeral bg-ink text-paper inline-flex h-9 w-9 items-center justify-center text-base">
              N
            </span>
            <span className="font-display text-[22px] tracking-[-0.02em]">Nexa</span>
          </div>
          {eyebrow && <p className="eyebrow justify-center">{eyebrow}</p>}
          <h1 className="font-display mt-3 text-[30px] leading-tight tracking-[-0.02em]">
            {title}
          </h1>
          {subtitle && <p className="text-ink-3 mt-2 text-sm">{subtitle}</p>}
        </div>

        <div className="bg-receipt border-ink/14 shadow-recibo border p-6 md:p-7">{children}</div>

        {footer && <p className="eyebrow text-ink-3 mt-6 text-center">{footer}</p>}
        <p className="eyebrow text-ink-3 mt-6 text-center">
          <Link href="/terminos-y-condiciones" className="hover:text-ink-2 transition-colors">
            Términos y Condiciones
          </Link>
          {' · '}
          <Link href="/politica-de-privacidad" className="hover:text-ink-2 transition-colors">
            Política de Privacidad
          </Link>
        </p>
      </div>
    </div>
  );
}
