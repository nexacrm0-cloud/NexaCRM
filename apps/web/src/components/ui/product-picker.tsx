'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api-client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, ChevronsUpDown, Package, Loader2, X } from 'lucide-react';
import { useFormatCurrency } from '@/hooks/use-format-currency';

export type PickerVariant = {
  id: string;
  name: string | null;
  sku: string | null;
  price: string | number | null;
  stock: number;
  isActive: boolean;
};

export type PickerProduct = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: string | number;
  unit: string | null;
  trackStock: boolean;
  stock: number;
  variants?: PickerVariant[];
};

export function ProductPicker({
  selectedProduct,
  selectedVariant,
  onSelectProduct,
  onSelectVariant,
  onClear,
}: {
  selectedProduct?: PickerProduct | null;
  selectedVariant?: PickerVariant | null;
  onSelectProduct: (product: PickerProduct) => void;
  onSelectVariant: (product: PickerProduct, variant: PickerVariant) => void;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<PickerProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const formatCurrency = useFormatCurrency();

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get<{ data: PickerProduct[] }>('/inventory/products', {
          search: search || undefined,
          limit: '20',
        });
        setProducts(res.data ?? []);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [search]);

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between pr-8 font-normal"
          >
            {selectedProduct ? (
              <div className="flex min-w-0 items-center gap-2 text-left">
                <Package className="text-muted-foreground h-4 w-4 shrink-0" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm">
                    {selectedProduct.name}
                    {selectedVariant?.name ? ` — ${selectedVariant.name}` : ''}
                  </span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {(selectedVariant?.sku || selectedProduct.sku) +
                      (selectedProduct.unit ? ` · ${selectedProduct.unit}` : '')}
                  </span>
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground">Elegir producto (opcional)...</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[360px] p-0" align="start">
          <div className="p-2">
            <Input
              placeholder="Buscar por nombre o SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
              </div>
            ) : products.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                {search ? 'Sin resultados' : 'Escribe para buscar'}
              </p>
            ) : (
              products.map((product) => {
                const isSelected = product.id === selectedProduct?.id && !selectedVariant;
                const variantMatches = product.id === selectedProduct?.id && selectedVariant;
                const variantCount = product.variants?.filter((v) => v.isActive).length ?? 0;
                return (
                  <button
                    key={product.id}
                    onClick={() => {
                      if (variantCount === 1) {
                        const v = product.variants!.find((x) => x.isActive)!;
                        onSelectVariant(product, v);
                      } else if (variantCount > 1) {
                        onSelectProduct(product);
                      } else {
                        onSelectProduct(product);
                      }
                      setOpen(false);
                      setSearch('');
                    }}
                    className="hover:bg-accent flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors"
                  >
                    <div className="bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                      <Package className="text-primary h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{product.name}</p>
                      <p className="text-muted-foreground font-mono text-xs">
                        {product.sku}
                        {product.unit ? ` · ${product.unit}` : ''}
                        {variantCount > 1 ? ` · ${variantCount} variantes` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tabular text-sm font-medium">
                        {formatCurrency(Number(product.price))}
                      </p>
                      {product.trackStock && (
                        <p className="text-muted-foreground text-[10px]">Stock: {product.stock}</p>
                      )}
                    </div>
                    {(isSelected || variantMatches) && (
                      <Check className="text-primary h-4 w-4 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
      {(selectedProduct || selectedVariant) && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="hover:bg-muted text-muted-foreground hover:text-foreground absolute right-8 top-1/2 -translate-y-1/2 rounded p-1"
          aria-label="Quitar producto"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
