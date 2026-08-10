'use client';

import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, Layers, Loader2 } from 'lucide-react';
import { useFormatCurrency } from '@/hooks/use-format-currency';
import type { PickerVariant } from './product-picker';

export function VariantPicker({
  variants,
  selectedId,
  onSelect,
}: {
  variants: PickerVariant[];
  selectedId?: string | null;
  onSelect: (variant: PickerVariant) => void;
}) {
  const [open, setOpen] = useState(false);
  const formatCurrency = useFormatCurrency();
  const active = variants.filter((v) => v.isActive);
  const selected = active.find((v) => v.id === selectedId) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between text-xs font-normal"
        >
          {selected ? (
            <div className="flex min-w-0 items-center gap-2 text-left">
              <Layers className="text-muted-foreground h-3 w-3 shrink-0" />
              <span className="truncate">{selected.name || selected.sku || 'Variante'}</span>
              {selected.sku && (
                <span className="text-muted-foreground ml-1 font-mono text-[10px]">
                  {selected.sku}
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">Elegir variante ({active.length})...</span>
          )}
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="max-h-[240px] overflow-y-auto">
          {active.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">Sin variantes activas</p>
          ) : (
            active.map((variant) => (
              <button
                key={variant.id}
                onClick={() => {
                  onSelect(variant);
                  setOpen(false);
                }}
                className="hover:bg-accent flex w-full items-center gap-3 px-3 py-2 text-left text-xs transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {variant.name || variant.sku || 'Variante'}
                  </p>
                  {variant.sku && (
                    <p className="text-muted-foreground font-mono text-[10px]">{variant.sku}</p>
                  )}
                </div>
                <p className="tabular shrink-0">
                  {variant.price != null ? formatCurrency(Number(variant.price)) : ''}
                </p>
                <p className="text-muted-foreground w-16 shrink-0 text-right text-[10px]">
                  Stock {variant.stock}
                </p>
                {variant.id === selectedId && <Check className="text-primary h-3 w-3 shrink-0" />}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
