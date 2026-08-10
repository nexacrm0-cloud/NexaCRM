'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardEyebrow } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useFormatCurrency } from '@/hooks/use-format-currency';
import {
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Settings2,
  Package,
  Activity as ActivityIcon,
} from 'lucide-react';

type Movement = {
  id: string;
  type: 'IN' | 'OUT' | 'ADJUST';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string | null;
  reference: string | null;
  createdAt: string;
  product: { id: string; name: string; sku: string };
  productVariant: { id: string; name: string | null; sku: string | null } | null;
  createdBy: { id: string; firstName: string; lastName: string };
};

type Response = {
  data: Movement[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

const typeConfig = {
  IN: { label: 'Entrada', variant: 'default' as const, icon: ArrowUp, tone: 'text-emerald-700' },
  OUT: { label: 'Salida', variant: 'destructive' as const, icon: ArrowDown, tone: 'text-red-700' },
  ADJUST: {
    label: 'Ajuste',
    variant: 'secondary' as const,
    icon: Settings2,
    tone: 'text-amber-700',
  },
};

export default function MovementsPage() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<'all' | 'IN' | 'OUT' | 'ADJUST'>('all');
  const formatCurrency = useFormatCurrency();

  const { data, isLoading, isError, error, refetch } = useQuery<Response>({
    queryKey: ['movements', page, typeFilter],
    queryFn: () =>
      api.get('/inventory/movements', {
        page: String(page),
        limit: '20',
        type: typeFilter === 'all' ? undefined : typeFilter,
      }),
  });

  const movements = data?.data ?? [];
  const meta = data?.meta;

  const totalIn =
    data?.data.filter((m) => m.type === 'IN').reduce((sum, m) => sum + m.quantity, 0) ?? 0;
  const totalOut =
    data?.data.filter((m) => m.type === 'OUT').reduce((sum, m) => sum + m.quantity, 0) ?? 0;

  return (
    <div className="mx-auto max-w-[1280px] space-y-8 p-6">
      <PageHeader
        eyebrow="Inventario"
        numeral={String(meta?.total ?? 0).padStart(2, '0')}
        title="Movimientos de stock"
        description="Cada alta, baja o ajuste queda registrado. Trazabilidad para auditoría y reposición."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <CardEyebrow>Total movimientos</CardEyebrow>
          <p className="font-fraunces text-naranja tabular mt-2 text-3xl">{meta?.total ?? 0}</p>
        </Card>
        <Card className="p-4">
          <CardEyebrow>Entradas (página)</CardEyebrow>
          <p className="font-fraunces tabular mt-2 text-3xl text-emerald-700">+{totalIn}</p>
        </Card>
        <Card className="p-4">
          <CardEyebrow>Salidas (página)</CardEyebrow>
          <p className="font-fraunces tabular mt-2 text-3xl text-red-700">−{totalOut}</p>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="IN">Solo entradas</SelectItem>
            <SelectItem value="OUT">Solo salidas</SelectItem>
            <SelectItem value="ADJUST">Solo ajustes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="text-alizarin p-6">
              Error: {error?.message}
              <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-3">
                Reintentar
              </Button>
            </div>
          ) : movements.length === 0 ? (
            <EmptyState
              icon={ActivityIcon}
              title="Sin movimientos"
              description="Cuando los productos se muevan (emisión de factura, reposición, ajuste manual) van a aparecer acá."
            />
          ) : (
            <div className="divide-ink/10 divide-y">
              {movements.map((m) => {
                const cfg = typeConfig[m.type];
                const Icon = cfg.icon;
                const delta = m.newStock - m.previousStock;
                return (
                  <div
                    key={m.id}
                    className="hover:bg-paper-2 flex items-center gap-4 p-4 transition-colors"
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        m.type === 'IN'
                          ? 'bg-emerald-50'
                          : m.type === 'OUT'
                            ? 'bg-red-50'
                            : 'bg-amber-50'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${cfg.tone}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Package className="text-muted-foreground h-3 w-3 shrink-0" />
                        <span className="truncate font-medium">{m.product.name}</span>
                        {m.productVariant && (
                          <span className="text-muted-foreground text-sm">
                            — {m.productVariant.name || m.productVariant.sku}
                          </span>
                        )}
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </div>
                      <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono">{m.product.sku}</span>
                        <span>·</span>
                        <span>{new Date(m.createdAt).toLocaleString('es-AR')}</span>
                        <span>·</span>
                        <span>
                          {m.createdBy.firstName} {m.createdBy.lastName}
                        </span>
                        {m.reason && (
                          <>
                            <span>·</span>
                            <span className="italic">{m.reason}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`font-fraunces tabular text-lg font-bold ${cfg.tone}`}>
                        {delta > 0 ? '+' : ''}
                        {delta}
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        {m.previousStock} → {m.newStock}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-muted-foreground text-sm">
            Página {page} de {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
