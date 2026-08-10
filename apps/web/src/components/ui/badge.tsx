import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-[1px] border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-ink/22 bg-ink/5 text-ink',
        secondary: 'border-ink/14 bg-secondary text-ink-2',
        destructive: 'border-alizarin/35 bg-alizarin/10 text-alizarin',
        success: 'border-verde/35 bg-verde/10 text-verde',
        warning: 'border-naranja/40 bg-naranja/10 text-naranja',
        outline: 'border-ink/22 text-ink-2',
        accent: 'border-naranja bg-naranja text-paper',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
