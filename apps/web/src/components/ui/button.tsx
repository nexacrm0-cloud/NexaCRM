import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-[2px] text-sm font-medium tracking-[0.01em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cobalt disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-ink text-paper shadow-sm hover:bg-ink/90',
        ink: 'bg-ink text-paper shadow-sm hover:bg-ink/90',
        destructive: 'bg-alizarin text-paper shadow-sm hover:bg-alizarin/90',
        outline: 'border border-ink/30 bg-transparent text-ink hover:bg-ink/5',
        secondary: 'bg-paper-2 text-ink shadow-sm hover:bg-paper-2/80',
        ghost: 'hover:bg-ink/5 text-ink',
        link: 'text-cobalt underline-offset-4 hover:underline',
        accent: 'bg-naranja text-paper shadow-sm hover:bg-naranja/90',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-[2px] px-3 text-xs',
        lg: 'h-11 rounded-[2px] px-7',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
