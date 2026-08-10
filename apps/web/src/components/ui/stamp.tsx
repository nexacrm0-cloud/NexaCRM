import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

export type StampTone = 'ink' | 'cobalt' | 'naranja' | 'verde' | 'alizarin' | 'mute';

export type StampSize = 'sm' | 'md' | 'lg';

const TONE_BORDER: Record<StampTone, string> = {
  ink: 'border-ink/55 text-ink',
  cobalt: 'border-cobalt text-cobalt',
  naranja: 'border-naranja text-naranja',
  verde: 'border-verde text-verde',
  alizarin: 'border-alizarin text-alizarin',
  mute: 'border-ink/35 text-ink-3',
};

const SIZE: Record<StampSize, { wrap: string; text: string; pad: string }> = {
  sm: { wrap: 'rounded-[1px]', text: 'text-[9px]', pad: 'px-1.5 py-0.5' },
  md: { wrap: 'rounded-[2px]', text: 'text-[11px]', pad: 'px-2 py-1' },
  lg: { wrap: 'rounded-[2px]', text: 'text-[14px]', pad: 'px-3 py-1.5' },
};

export interface StampProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: StampTone;
  size?: StampSize;
  rotate?: number;
  framed?: boolean;
}

export function Stamp({
  tone = 'ink',
  size = 'md',
  rotate = -1,
  framed = true,
  className,
  children,
  ...props
}: StampProps) {
  const s = SIZE[size];
  return (
    <span
      className={cn(
        'stamped tabular inline-flex select-none items-center gap-1.5 whitespace-nowrap font-semibold uppercase leading-none tracking-[0.18em]',
        TONE_BORDER[tone],
        framed && 'border-2 border-double',
        !framed && 'border border-current',
        s.wrap,
        s.text,
        s.pad,
        className,
      )}
      style={{ transform: `rotate(${rotate}deg)` }}
      {...props}
    >
      {children}
    </span>
  );
}
