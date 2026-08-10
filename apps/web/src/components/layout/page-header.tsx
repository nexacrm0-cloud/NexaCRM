import { cn } from '@/lib/utils';
import type { HTMLAttributes, ReactNode } from 'react';

interface PageHeaderProps extends HTMLAttributes<HTMLDivElement> {
  eyebrow: string;
  title: string;
  description?: string | ReactNode;
  actions?: ReactNode;
  numeral?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  numeral,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={cn('border-ink/22 fade-up relative mb-8 border-b pb-6', className)}
      {...props}
    >
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="eyebrow mb-3">{eyebrow}</p>
          <h1 className="font-display text-ink text-[44px] font-medium leading-[1.04] tracking-[-0.025em]">
            {numeral && (
              <span className="font-display text-naranja tabular mr-3 align-baseline text-[28px]">
                {numeral}
              </span>
            )}
            {title}
          </h1>
          {description && <p className="text-ink-3 mt-3 max-w-prose text-[15px]">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
