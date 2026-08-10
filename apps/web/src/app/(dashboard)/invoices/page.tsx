'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Stamp } from '@/components/ui/stamp';
import { INVOICE_STATUS_LIST, lookupStatus } from '@/components/ui/status-stamps';
import { PageHeader } from '@/components/layout/page-header';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDate } from '@/lib/utils';
import { useFormatCurrency } from '@/hooks/use-format-currency';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  SendHorizonal,
  Ban,
  Pencil,
  Trash2,
  Receipt,
  Eye,
} from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  type CreateInvoiceInput,
  type UpdateInvoiceInput,
} from '@nexa/shared';
import { ClientSelect } from '@/components/ui/client-select';
import {
  ProductPicker,
  type PickerProduct,
  type PickerVariant,
} from '@/components/ui/product-picker';
import { VariantPicker } from '@/components/ui/variant-picker';

type InvoiceResponse = {
  data: Array<{
    id: string;
    number: string;
    title: string | null;
    invoiceType: string;
    pointOfSale: string;
    status: string;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    cuit: string | null;
    cae: string | null;
    issuedAt: string | null;
    paidAt: string | null;
    createdAt: string;
    client: { id: string; companyName: string; contactName: string };
    createdBy: { firstName: string; lastName: string };
  }>;
  meta: { total: number; page: number; limit: number; totalPages: number };
};

type InvoiceDetail = {
  id: string;
  number: string;
  title: string | null;
  invoiceType: string;
  pointOfSale: string;
  status: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string | null;
  terms: string | null;
  cuit: string | null;
  ivaCondition: string | null;
  cae: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  client: { id: string; companyName: string; contactName: string; email: string | null };
  createdBy: { id: string; firstName: string; lastName: string };
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  quote: { id: string; number: string; title: string } | null;
};

const typeLabels: Record<string, string> = {
  A: 'Factura A',
  B: 'Factura B',
  C: 'Factura C',
  E: 'Factura E',
  M: 'Factura M',
};

const statusColors: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'success' | 'outline'
> = {
  DRAFT: 'secondary',
  ISSUED: 'default',
  PAID: 'success',
  PARTIALLY_PAID: 'default',
  OVERDUE: 'destructive',
  CANCELLED: 'outline',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  ISSUED: 'Emitida',
  PAID: 'Pagada',
  PARTIALLY_PAID: 'Parcial',
  OVERDUE: 'Vencida',
  CANCELLED: 'Cancelada',
};

export default function InvoicesPage() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [viewingInvoiceId, setViewingInvoiceId] = useState<string | null>(null);
  const [productSelections, setProductSelections] = useState<
    Record<number, { product: PickerProduct; variant: PickerVariant | null }>
  >({});
  const queryClient = useQueryClient();
  const formatCurrency = useFormatCurrency();
  const { canCreate, canEdit, canDelete } = usePermissions();

  const { data, isLoading, isError, error, refetch } = useQuery<InvoiceResponse>({
    queryKey: ['invoices', page],
    queryFn: () => api.get('/invoices', { page: String(page), limit: '12' }),
  });

  const { data: invoiceDetail, isLoading: invoiceDetailLoading } = useQuery<InvoiceDetail>({
    queryKey: ['invoice', viewingInvoiceId],
    queryFn: () => api.get(`/invoices/${viewingInvoiceId}`),
    enabled: !!viewingInvoiceId,
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateInvoiceInput) => api.post('/invoices', body),
    onSuccess: () => {
      toast({ title: 'Factura creada', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const issueMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/invoices/${id}/issue`),
    onSuccess: () => {
      toast({ title: 'Factura emitida', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const payMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/invoices/${id}/pay`),
    onSuccess: () => {
      toast({ title: 'Factura marcada como pagada', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/invoices/${id}/cancel`),
    onSuccess: () => {
      toast({ title: 'Factura cancelada', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/invoices/${id}`),
    onSuccess: () => {
      toast({ title: 'Factura eliminada', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateInvoiceInput }) =>
      api.patch(`/invoices/${id}`, body),
    onSuccess: () => {
      toast({ title: 'Factura actualizada', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setEditingInvoiceId(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const form = useForm<CreateInvoiceInput>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      items: [{ description: '', quantity: 1, unitPrice: 0, discount: 0 }],
      invoiceType: 'B' as any,
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <PageHeader
        eyebrow="Facturación"
        numeral={String(data?.meta.total ?? 0).padStart(2, '0')}
        title="Facturación"
        description="Borrador → emitida → cobrada. Cada factura es una comanda, no un archivo."
        actions={
          canCreate ? (
            <Button variant="ink" size="sm" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-3.5 w-3.5" />
              Nueva factura
            </Button>
          ) : undefined
        }
      />

      {canCreate && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">Nueva factura</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label className="eyebrow">Título (opcional)</Label>
                <Input {...form.register('title')} placeholder="Ej: Servicios de consultoría" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="eyebrow">Tipo de factura</Label>
                  <Select
                    value={form.watch('invoiceType')}
                    onValueChange={(v) => form.setValue('invoiceType', v as any)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">Factura A</SelectItem>
                      <SelectItem value="B">Factura B</SelectItem>
                      <SelectItem value="C">Factura C</SelectItem>
                      <SelectItem value="E">Factura E</SelectItem>
                      <SelectItem value="M">Factura M</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="eyebrow">Punto de venta</Label>
                  <Input {...form.register('pointOfSale')} placeholder="0001" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="eyebrow">Cliente</Label>
                <ClientSelect
                  value={form.watch('clientId')}
                  onChange={(v) => form.setValue('clientId', v, { shouldValidate: true })}
                />
                <p className="eyebrow text-alizarin">{form.formState.errors.clientId?.message}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="eyebrow">CUIT</Label>
                  <Input {...form.register('cuit')} placeholder="30-12345678-9" />
                </div>
                <div className="space-y-2">
                  <Label className="eyebrow">Condición IVA</Label>
                  <Input {...form.register('ivaCondition')} placeholder="Responsable Inscripto" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="eyebrow">IVA (%)</Label>
                <Input
                  type="number"
                  {...form.register('taxRate', { valueAsNumber: true })}
                  placeholder="21"
                />
              </div>
              <div className="space-y-2">
                <Label className="eyebrow">Items</Label>
                <p className="eyebrow text-alizarin">
                  {form.formState.errors.items?.root?.message ||
                    form.formState.errors.items?.message}
                </p>
                {fields.map((field, index) => {
                  const sel = productSelections[index];
                  const variantCount = sel?.product.variants?.filter((v) => v.isActive).length ?? 0;
                  return (
                    <div
                      key={field.id}
                      className="border-ink/10 bg-paper-2 space-y-2 rounded-lg border p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <ProductPicker
                          selectedProduct={sel?.product ?? null}
                          selectedVariant={sel?.variant ?? null}
                          onSelectProduct={(product) => {
                            if ((product.variants?.filter((v) => v.isActive).length ?? 0) <= 1) {
                              const v = product.variants?.find((x) => x.isActive) ?? null;
                              const desc = v?.name ? `${product.name} — ${v.name}` : product.name;
                              const price =
                                v?.price != null ? Number(v.price) : Number(product.price);
                              form.setValue(`items.${index}.description`, desc, {
                                shouldDirty: true,
                              });
                              form.setValue(`items.${index}.unitPrice`, price, {
                                shouldDirty: true,
                              });
                              form.setValue(`items.${index}.productVariantId`, v?.id ?? '', {
                                shouldDirty: true,
                              });
                              setProductSelections((prev) => ({
                                ...prev,
                                [index]: { product, variant: v },
                              }));
                            } else {
                              setProductSelections((prev) => ({
                                ...prev,
                                [index]: { product, variant: null },
                              }));
                            }
                          }}
                          onSelectVariant={(product, variant) => {
                            const desc = variant.name
                              ? `${product.name} — ${variant.name}`
                              : product.name;
                            const price =
                              variant.price != null ? Number(variant.price) : Number(product.price);
                            form.setValue(`items.${index}.description`, desc, {
                              shouldDirty: true,
                            });
                            form.setValue(`items.${index}.unitPrice`, price, { shouldDirty: true });
                            form.setValue(`items.${index}.productVariantId`, variant.id, {
                              shouldDirty: true,
                            });
                            setProductSelections((prev) => ({
                              ...prev,
                              [index]: { product, variant },
                            }));
                          }}
                          onClear={() => {
                            form.setValue(`items.${index}.description`, '', { shouldDirty: true });
                            form.setValue(`items.${index}.unitPrice`, 0, { shouldDirty: true });
                            form.setValue(`items.${index}.productVariantId`, '', {
                              shouldDirty: true,
                            });
                            setProductSelections((prev) => {
                              const next = { ...prev };
                              delete next[index];
                              return next;
                            });
                          }}
                        />
                        {index > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              remove(index);
                              setProductSelections((prev) => {
                                const next = { ...prev };
                                delete next[index];
                                return next;
                              });
                            }}
                            className="shrink-0"
                          >
                            ✕
                          </Button>
                        )}
                      </div>
                      {sel && variantCount > 1 && (
                        <VariantPicker
                          variants={sel.product.variants!.filter((v) => v.isActive)}
                          selectedId={sel.variant?.id ?? null}
                          onSelect={(variant) => {
                            const desc = variant.name
                              ? `${sel.product.name} — ${variant.name}`
                              : sel.product.name;
                            const price =
                              variant.price != null
                                ? Number(variant.price)
                                : Number(sel.product.price);
                            form.setValue(`items.${index}.description`, desc, {
                              shouldDirty: true,
                            });
                            form.setValue(`items.${index}.unitPrice`, price, { shouldDirty: true });
                            form.setValue(`items.${index}.productVariantId`, variant.id, {
                              shouldDirty: true,
                            });
                            setProductSelections((prev) => ({
                              ...prev,
                              [index]: { product: sel.product, variant },
                            }));
                          }}
                        />
                      )}
                      <div className="grid grid-cols-4 items-end gap-2">
                        <Input
                          {...form.register(`items.${index}.description`)}
                          placeholder="Descripción"
                        />
                        <Input
                          {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                          type="number"
                          placeholder="Cant."
                        />
                        <Input
                          {...form.register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                          type="number"
                          placeholder="Precio"
                        />
                        <Input
                          {...form.register(`items.${index}.discount`, { valueAsNumber: true })}
                          type="number"
                          placeholder="% Desc."
                          min="0"
                          max="100"
                        />
                      </div>
                    </div>
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      description: '',
                      quantity: 1,
                      unitPrice: 0,
                      discount: 0,
                      productVariantId: '',
                    } as any)
                  }
                >
                  + Agregar item
                </Button>
              </div>
              <Button
                type="submit"
                className="w-full"
                variant="ink"
                disabled={createMutation.isPending}
              >
                Crear factura
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {isError ? (
        <div className="text-alizarin flex h-48 flex-col items-center justify-center gap-3">
          <p>No pudimos cargar tus facturas. {error?.message || 'Error desconocido'}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : isLoading ? (
        <div className="border-ink/14 grid gap-px border md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-receipt space-y-3 p-5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-28" />
            </div>
          ))}
        </div>
      ) : data?.data.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No hay facturas todavía"
          description="Las facturas nacen de un presupuesto aceptado o de un alta manual. Empezá por acá."
          action={
            canCreate ? (
              <Button onClick={() => setOpen(true)} variant="ink">
                <Plus className="mr-2 h-4 w-4" />
                Nueva factura
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="border-ink/14 grid gap-px border md:grid-cols-2 lg:grid-cols-3">
          {data?.data.map((invoice) => {
            const s = lookupStatus(INVOICE_STATUS_LIST, invoice.status);
            return (
              <article
                key={invoice.id}
                className="bg-receipt hover:bg-paper-2 fade-up p-5 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="eyebrow text-ink-3">
                      {typeLabels[invoice.invoiceType] || invoice.invoiceType} {invoice.pointOfSale}
                      -{invoice.number}
                    </p>
                    <h3 className="font-display truncate text-[19px] leading-tight">
                      {invoice.title || `Factura ${invoice.number}`}
                    </h3>
                    <p className="text-ink-3 text-xs">
                      {invoice.client.companyName} &middot; {formatDate(invoice.createdAt)}
                    </p>
                    {invoice.cae && <p className="eyebrow text-ink-3 mt-1">CAE · {invoice.cae}</p>}
                  </div>
                  <Stamp tone={s.tone} size="sm" rotate={invoice.status === 'PAID' ? 1.5 : -1.5}>
                    {s.stamp}
                  </Stamp>
                </div>
                <p className="numeral text-naranja tabular mt-6 text-[28px]">
                  {formatCurrency(Number(invoice.total))}
                </p>
                <div className="border-ink/14 mt-5 flex flex-wrap gap-1.5 border-t pt-5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[11px]"
                    onClick={() => setViewingInvoiceId(invoice.id)}
                  >
                    <Eye className="mr-1 h-3 w-3" />
                    Ver
                  </Button>
                  {invoice.status === 'DRAFT' && canEdit && (
                    <Button
                      variant="ink"
                      size="sm"
                      className="text-[11px]"
                      onClick={() => issueMutation.mutate(invoice.id)}
                    >
                      <SendHorizonal className="mr-1 h-3 w-3" />
                      Emitir
                    </Button>
                  )}
                  {invoice.status === 'ISSUED' && canEdit && (
                    <Button
                      variant="ink"
                      size="sm"
                      className="text-[11px]"
                      onClick={() => payMutation.mutate(invoice.id)}
                    >
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Cobrar
                    </Button>
                  )}
                  {(invoice.status === 'DRAFT' || invoice.status === 'ISSUED') && canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[11px]"
                      onClick={() => cancelMutation.mutate(invoice.id)}
                    >
                      <Ban className="mr-1 h-3 w-3" />
                      Anular
                    </Button>
                  )}
                  {invoice.status === 'DRAFT' && canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-alizarin hover:text-alizarin text-[11px]"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar factura?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(invoice.id)}>
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {data?.meta && data.meta.totalPages > 1 && (
        <nav className="flex items-center justify-center gap-3 pt-2" aria-label="Paginación">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
          </Button>
          <span className="eyebrow text-ink-3">
            Página {String(page).padStart(2, '0')} / {String(data.meta.totalPages).padStart(2, '0')}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))}
            disabled={page >= data.meta.totalPages}
          >
            Siguiente <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </nav>
      )}

      <Dialog
        open={!!viewingInvoiceId}
        onOpenChange={(o) => {
          if (!o) setViewingInvoiceId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Detalle de factura</DialogTitle>
          </DialogHeader>
          {!invoiceDetail || invoiceDetailLoading || !viewingInvoiceId ? (
            <div className="flex justify-center py-8">
              <Loader2 className="text-cobalt h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="border-ink/14 flex items-start justify-between gap-3 border-b pb-4">
                <div>
                  <p className="eyebrow text-ink-3 mb-1">
                    {typeLabels[invoiceDetail.invoiceType] || invoiceDetail.invoiceType}{' '}
                    {invoiceDetail.pointOfSale}-{invoiceDetail.number}
                  </p>
                  <p className="font-display text-[22px] leading-tight">
                    {invoiceDetail.title || 'Factura'}
                  </p>
                </div>
                {(() => {
                  const s = lookupStatus(INVOICE_STATUS_LIST, invoiceDetail.status);
                  return (
                    <Stamp tone={s.tone} size="md">
                      {s.stamp}
                    </Stamp>
                  );
                })()}
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div className="space-y-1">
                  <dt className="eyebrow text-ink-3">Cliente</dt>
                  <dd className="font-medium">{invoiceDetail.client.companyName}</dd>
                  {invoiceDetail.client.contactName && (
                    <dd className="text-ink-3 text-xs">{invoiceDetail.client.contactName}</dd>
                  )}
                  {invoiceDetail.client.email && (
                    <dd className="text-ink-3 text-xs">{invoiceDetail.client.email}</dd>
                  )}
                </div>
                <div className="space-y-1">
                  <dt className="eyebrow text-ink-3">CUIT</dt>
                  <dd className="font-mono">{invoiceDetail.cuit || '—'}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="eyebrow text-ink-3">Condición IVA</dt>
                  <dd className="font-medium">{invoiceDetail.ivaCondition || '—'}</dd>
                </div>
                {invoiceDetail.cae && (
                  <div className="space-y-1">
                    <dt className="eyebrow text-ink-3">CAE</dt>
                    <dd className="font-mono">{invoiceDetail.cae}</dd>
                  </div>
                )}
                {invoiceDetail.quote && (
                  <div className="col-span-2 space-y-1">
                    <dt className="eyebrow text-ink-3">Presupuesto</dt>
                    <dd className="font-medium">
                      {invoiceDetail.quote.title}{' '}
                      <span className="text-ink-3">({invoiceDetail.quote.number})</span>
                    </dd>
                  </div>
                )}
              </dl>

              <div>
                <p className="eyebrow text-ink-3 mb-2">Ítems</p>
                <div className="border-ink/14 border">
                  <table className="tabular w-full text-sm">
                    <thead>
                      <tr className="bg-paper-2 text-ink-3 border-ink/14 border-b">
                        <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-[0.14em]">
                          Descripción
                        </th>
                        <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-[0.14em]">
                          Cant.
                        </th>
                        <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-[0.14em]">
                          Precio
                        </th>
                        <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-[0.14em]">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceDetail.items.map((item) => (
                        <tr key={item.id} className="border-ink/10 border-t">
                          <td className="px-3 py-2">{item.description}</td>
                          <td className="px-3 py-2 text-right">{item.quantity}</td>
                          <td className="px-3 py-2 text-right">
                            {formatCurrency(Number(item.unitPrice))}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            {formatCurrency(Number(item.total))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="border-ink/14 space-y-2 border-t pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-3">Subtotal</span>
                  <span className="tabular">{formatCurrency(Number(invoiceDetail.subtotal))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-3">IVA ({invoiceDetail.taxRate}%)</span>
                  <span className="tabular">{formatCurrency(Number(invoiceDetail.taxAmount))}</span>
                </div>
                <div className="border-ink/14 mt-1 flex items-baseline justify-between border-t pt-3">
                  <span className="eyebrow text-ink">Total</span>
                  <span className="numeral text-naranja text-[26px]">
                    {formatCurrency(Number(invoiceDetail.total))}
                  </span>
                </div>
              </div>

              {invoiceDetail.notes && (
                <div>
                  <p className="eyebrow text-ink-3 mb-1">Notas</p>
                  <p className="whitespace-pre-wrap text-sm">{invoiceDetail.notes}</p>
                </div>
              )}
              {invoiceDetail.terms && (
                <div>
                  <p className="eyebrow text-ink-3 mb-1">Términos</p>
                  <p className="whitespace-pre-wrap text-sm">{invoiceDetail.terms}</p>
                </div>
              )}

              <div className="border-ink/14 text-ink-3 space-y-1 border-t pt-4 text-xs">
                <p>
                  Creada por {invoiceDetail.createdBy.firstName} {invoiceDetail.createdBy.lastName}{' '}
                  · {formatDate(invoiceDetail.createdAt)}
                </p>
                {invoiceDetail.issuedAt && <p>Emitida · {formatDate(invoiceDetail.issuedAt)}</p>}
                {invoiceDetail.paidAt && <p>Pagada · {formatDate(invoiceDetail.paidAt)}</p>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
