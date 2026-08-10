'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowUp, ArrowDown, Settings2 } from 'lucide-react';

export function StockAdjustDialog({
  open,
  onOpenChange,
  productId,
  productName,
  currentStock,
  variants,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  productId: string;
  productName: string;
  currentStock: number;
  variants: Array<{
    id: string;
    name: string | null;
    sku: string | null;
    stock: number;
    isActive: boolean;
  }>;
}) {
  const [type, setType] = useState<'IN' | 'OUT' | 'ADJUST'>('IN');
  const [quantity, setQuantity] = useState(1);
  const [variantId, setVariantId] = useState<string>('none');
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/inventory/products/${productId}/movements`, {
        type,
        quantity,
        variantId: variantId === 'none' ? null : variantId,
        reason: reason || undefined,
      }),
    onSuccess: () => {
      toast({ title: 'Movimiento registrado', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['movements'] });
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      onOpenChange(false);
      setQuantity(1);
      setReason('');
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const variantStock =
    variantId === 'none' ? currentStock : (variants.find((v) => v.id === variantId)?.stock ?? 0);

  const delta = type === 'IN' ? quantity : type === 'OUT' ? -quantity : 0;
  const newStock = type === 'ADJUST' ? quantity : Math.max(0, variantStock + delta);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Ajustar stock</DialogTitle>
          <p className="eyebrow text-ink-3 mt-1">{productName}</p>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={type === 'IN' ? 'default' : 'outline'}
              onClick={() => setType('IN')}
              className={
                type === 'IN'
                  ? 'border-emerald-700 bg-emerald-50 text-emerald-800 hover:bg-emerald-50'
                  : ''
              }
            >
              <ArrowUp className="mr-1 h-4 w-4" /> Entrada
            </Button>
            <Button
              type="button"
              variant={type === 'OUT' ? 'default' : 'outline'}
              onClick={() => setType('OUT')}
              className={
                type === 'OUT' ? 'border-red-700 bg-red-50 text-red-800 hover:bg-red-50' : ''
              }
            >
              <ArrowDown className="mr-1 h-4 w-4" /> Salida
            </Button>
          </div>

          {variants.length > 0 && (
            <div className="space-y-2">
              <Label className="eyebrow">Variante</Label>
              <Select value={variantId} onValueChange={setVariantId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Stock global del producto</SelectItem>
                  {variants
                    .filter((v) => v.isActive)
                    .map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name || v.sku} (stock {v.stock})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="eyebrow">
              {type === 'ADJUST' ? 'Stock final deseado' : 'Cantidad'}
            </Label>
            <Input
              type="number"
              min={type === 'OUT' ? 1 : 0}
              max={type === 'ADJUST' ? undefined : variantStock}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value || '0', 10)))}
            />
          </div>

          <div className="space-y-2">
            <Label className="eyebrow">Razón (opcional)</Label>
            <Input
              placeholder="Ej: Reposición, conteo físico, merma..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="bg-paper-2 border-ink/10 rounded-lg border p-3">
            <p className="eyebrow text-ink-3">Vista previa</p>
            <p className="font-fraunces mt-1 text-2xl">
              {variantStock} →{' '}
              <span
                className={
                  newStock > variantStock
                    ? 'text-emerald-700'
                    : newStock < variantStock
                      ? 'text-red-700'
                      : ''
                }
              >
                {newStock}
              </span>
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending || quantity <= 0}>
              {mutation.isPending ? 'Registrando...' : 'Registrar movimiento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
