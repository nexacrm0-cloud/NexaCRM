'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Stamp } from '@/components/ui/stamp';
import { QUOTE_STATUS_LIST, lookupStatus } from '@/components/ui/status-stamps';
import { PageHeader } from '@/components/layout/page-header';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { formatDate } from '@/lib/utils';
import { useFormatCurrency } from '@/hooks/use-format-currency';
import { usePermissions } from '@/hooks/use-permissions';
import { API_BASE } from '@/lib/api-client';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  FileText,
  Download,
  Send,
  Pencil,
  Trash2,
  Loader2,
  Check,
  X,
  Receipt,
} from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createQuoteSchema,
  updateQuoteSchema,
  type CreateQuoteInput,
  type UpdateQuoteInput,
} from '@nexa/shared';
import { ClientSelect } from '@/components/ui/client-select';
import {
  ProductPicker,
  type PickerProduct,
  type PickerVariant,
} from '@/components/ui/product-picker';
import { VariantPicker } from '@/components/ui/variant-picker';

type QuotesResponse = {
  data: Array<{
    id: string;
    number: string;
    title: string;
    status: string;
    total: number;
    createdAt: string;
    client: { id: string; companyName: string; contactName: string };
    createdBy: { firstName: string; lastName: string };
  }>;
  meta: { total: number; page: number; limit: number; totalPages: number };
};

const statusColors: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'success' | 'outline'
> = {
  DRAFT: 'secondary',
  SENT: 'default',
  ACCEPTED: 'success',
  REJECTED: 'destructive',
  EXPIRED: 'outline',
};

const quoteStatusMap = Object.fromEntries(
  QUOTE_STATUS_LIST.map((s) => [s.key, { tone: s.tone, stamp: s.stamp }]),
);

type QuoteDetail = {
  id: string;
  title: string;
  notes: string | null;
  terms: string | null;
  taxRate: number;
  validUntil: string | null;
  number: string;
  status: string;
  total: number;
  subtotal: number;
  taxAmount: number;
  client: { id: string; companyName: string; contactName: string };
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
};

export default function QuotesPage() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [productSelections, setProductSelections] = useState<
    Record<number, { product: PickerProduct; variant: PickerVariant | null }>
  >({});
  const [editProductSelections, setEditProductSelections] = useState<
    Record<number, { product: PickerProduct; variant: PickerVariant | null }>
  >({});
  const queryClient = useQueryClient();
  const formatCurrency = useFormatCurrency();
  const { canCreate, canEdit, canDelete } = usePermissions();

  const { data, isLoading, isError, error, refetch } = useQuery<QuotesResponse>({
    queryKey: ['quotes', page],
    queryFn: () => api.get('/quotes', { page: String(page), limit: '12' }),
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateQuoteInput) => api.post('/quotes', body),
    onSuccess: () => {
      toast({ title: 'Presupuesto creado', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/quotes/${id}/send`),
    onSuccess: () => {
      toast({ title: 'Presupuesto enviado al cliente', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/quotes/${id}`),
    onSuccess: () => {
      toast({ title: 'Presupuesto eliminado', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/quotes/${id}/accept`),
    onSuccess: () => {
      toast({ title: 'Presupuesto aceptado', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/quotes/${id}/reject`),
    onSuccess: () => {
      toast({ title: 'Presupuesto rechazado', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateQuoteInput }) =>
      api.patch(`/quotes/${id}`, body),
    onSuccess: () => {
      toast({ title: 'Presupuesto actualizado', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setEditingQuoteId(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const createInvoiceFromQuoteMutation = useMutation({
    mutationFn: (quoteId: string) => api.post(`/invoices/from-quote/${quoteId}`),
    onSuccess: () => {
      toast({ title: 'Factura generada desde el presupuesto', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const { data: quoteDetail } = useQuery<QuoteDetail>({
    queryKey: ['quote', editingQuoteId],
    queryFn: () => api.get(`/quotes/${editingQuoteId!}`),
    enabled: !!editingQuoteId,
  });

  const form = useForm<CreateQuoteInput>({
    resolver: zodResolver(createQuoteSchema),
    defaultValues: { items: [{ description: '', quantity: 1, unitPrice: 0, discount: 0 }] },
  });

  const editForm = useForm<UpdateQuoteInput>({
    resolver: zodResolver(updateQuoteSchema),
  });

  useEffect(() => {
    if (quoteDetail) {
      editForm.reset({
        title: quoteDetail.title,
        notes: quoteDetail.notes || '',
        terms: quoteDetail.terms || '',
        taxRate: quoteDetail.taxRate,
        validUntil: quoteDetail.validUntil || '',
        items: quoteDetail.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      });
    }
  }, [quoteDetail, editForm]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const {
    fields: editFields,
    append: editAppend,
    remove: editRemove,
  } = useFieldArray({
    control: editForm.control,
    name: 'items',
  });

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <PageHeader
        eyebrow="CotizaciÃ³n"
        numeral={String(data?.meta.total ?? 0).padStart(2, '0')}
        title="Presupuestos"
        description="Cotizaciones que armaste o que te pidieron. Un click las enviÃ¡s, aceptÃ¡s, facturÃ¡s."
        actions={
          canCreate ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="ink" size="sm">
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Nuevo presupuesto
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle className="font-display">Nuevo presupuesto</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label className="eyebrow">TÃ­tulo</Label>
                    <Input {...form.register('title')} placeholder="Ej: ImplementaciÃ³n CRM" />
                    <p className="eyebrow text-alizarin">{form.formState.errors.title?.message}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="eyebrow">Cliente</Label>
                    <ClientSelect
                      value={form.watch('clientId')}
                      onChange={(v) => form.setValue('clientId', v, { shouldValidate: true })}
                    />
                    <p className="eyebrow text-alizarin">
                      {form.formState.errors.clientId?.message}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="eyebrow">IVA (%)</Label>
                    <Input
                      type="number"
                      {...form.register('taxRate', { valueAsNumber: true })}
                      placeholder="21"
                    />
                    <p className="eyebrow text-alizarin">
                      {form.formState.errors.taxRate?.message}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="eyebrow">Items</Label>
                    <p className="eyebrow text-alizarin">
                      {form.formState.errors.items?.root?.message ||
                        form.formState.errors.items?.message}
                    </p>
                    {fields.map((field, index) => {
                      const sel = productSelections[index];
                      const variantCount =
                        sel?.product.variants?.filter((v) => v.isActive).length ?? 0;
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
                                if (
                                  (product.variants?.filter((v) => v.isActive).length ?? 0) <= 1
                                ) {
                                  const v = product.variants?.find((x) => x.isActive) ?? null;
                                  const desc = v?.name
                                    ? `${product.name} — ${v.name}`
                                    : product.name;
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
                                  variant.price != null
                                    ? Number(variant.price)
                                    : Number(product.price);
                                form.setValue(`items.${index}.description`, desc, {
                                  shouldDirty: true,
                                });
                                form.setValue(`items.${index}.unitPrice`, price, {
                                  shouldDirty: true,
                                });
                                form.setValue(`items.${index}.productVariantId`, variant.id, {
                                  shouldDirty: true,
                                });
                                setProductSelections((prev) => ({
                                  ...prev,
                                  [index]: { product, variant },
                                }));
                              }}
                              onClear={() => {
                                form.setValue(`items.${index}.description`, '', {
                                  shouldDirty: true,
                                });
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
                                form.setValue(`items.${index}.unitPrice`, price, {
                                  shouldDirty: true,
                                });
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
                              {...form.register(`items.${index}.unitPrice`, {
                                valueAsNumber: true,
                              })}
                              type="number"
                              placeholder="Precio"
                            />
                            <Input
                              {...form.register(`items.${index}.discount`, { valueAsNumber: true })}
                              type="number"
                              placeholder="Desc. %"
                              min="0"
                              max="100"
                              step="0.01"
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
                    Crear presupuesto
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      {isError ? (
        <div className="text-alizarin flex h-48 flex-col items-center justify-center gap-3">
          <p>Error al cargar presupuestos: {error?.message || 'Error desconocido'}</p>
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
      ) : data?.data?.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No hay presupuestos"
          description="TodavÃ­a no generaste ningÃºn presupuesto. ArmÃ¡ el primero y mandalo a tu cliente."
          action={
            canCreate ? (
              <Button onClick={() => setOpen(true)} variant="ink">
                <Plus className="mr-2 h-4 w-4" />
                Nuevo presupuesto
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="border-ink/14 grid gap-px border md:grid-cols-2 lg:grid-cols-3">
            {data?.data.map((quote) => {
              const s = lookupStatus(QUOTE_STATUS_LIST, quote.status);
              return (
                <article
                  key={quote.id}
                  className="bg-receipt hover:bg-receipt-2 fade-up p-5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="eyebrow text-ink-3">{quote.number}</p>
                      <h3 className="font-display truncate text-[19px] leading-tight">
                        {quote.title}
                      </h3>
                      <p className="text-ink-3 text-xs">
                        {quote.client.companyName} &middot; {formatDate(quote.createdAt)}
                      </p>
                    </div>
                    <Stamp tone={s.tone} size="sm">
                      {s.stamp}
                    </Stamp>
                  </div>
                  <p className="numeral text-naranja mt-6 text-[26px]">
                    {formatCurrency(Number(quote.total))}
                  </p>
                  <div className="border-ink/14 mt-5 flex flex-wrap gap-1.5 border-t pt-5">
                    {quote.status === 'DRAFT' && canEdit && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => setEditingQuoteId(quote.id)}
                        >
                          <Pencil className="mr-1 h-3 w-3" />
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => sendMutation.mutate(quote.id)}
                        >
                          <Send className="mr-1 h-3 w-3" />
                          Enviar
                        </Button>
                      </>
                    )}
                    {quote.status === 'SENT' && canEdit && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs text-green-600 hover:text-green-600"
                          onClick={() => acceptMutation.mutate(quote.id)}
                        >
                          <Check className="mr-1 h-3 w-3" />
                          Aceptar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive text-xs"
                          onClick={() => rejectMutation.mutate(quote.id)}
                        >
                          <X className="mr-1 h-3 w-3" />
                          Rechazar
                        </Button>
                      </>
                    )}
                    {quote.status === 'ACCEPTED' && canEdit && (
                      <Button
                        size="sm"
                        variant="default"
                        className="text-xs"
                        onClick={() => createInvoiceFromQuoteMutation.mutate(quote.id)}
                      >
                        <Receipt className="mr-1 h-3 w-3" />
                        Generar factura
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-xs" asChild>
                      <a
                        href={`${API_BASE}/quotes/${quote.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="mr-1 h-3 w-3" />
                        PDF
                      </a>
                    </Button>
                    {canDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive text-xs"
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            Eliminar
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Â¿Eliminar presupuesto?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acciÃ³n no se puede deshacer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(quote.id)}>
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
          {data?.meta && data.meta.totalPages > 1 && (
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
                PÃ¡gina {page} de {data.meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog
        open={!!editingQuoteId}
        onOpenChange={(o) => {
          if (!o) setEditingQuoteId(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar presupuesto</DialogTitle>
          </DialogHeader>
          {!quoteDetail ? (
            <div className="flex justify-center py-8">
              <Loader2 className="text-primary h-6 w-6 animate-spin" />
            </div>
          ) : (
            <form
              onSubmit={editForm.handleSubmit((data) => {
                if (editingQuoteId) updateMutation.mutate({ id: editingQuoteId, body: data });
              })}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>TÃ­tulo</Label>
                <Input {...editForm.register('title')} placeholder="Ej: ImplementaciÃ³n CRM" />
                <p className="text-destructive text-sm">
                  {editForm.formState.errors.title?.message}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <p className="text-muted-foreground text-sm">{quoteDetail.client.companyName}</p>
              </div>
              <div className="space-y-2">
                <Label>IVA (%)</Label>
                <Input type="number" {...editForm.register('taxRate', { valueAsNumber: true })} />
                <p className="text-destructive text-sm">
                  {editForm.formState.errors.taxRate?.message}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Items</Label>
                {editFields.map((field, index) => {
                  const sel = editProductSelections[index];
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
                              editForm.setValue(`items.${index}.description`, desc, {
                                shouldDirty: true,
                              });
                              editForm.setValue(`items.${index}.unitPrice`, price, {
                                shouldDirty: true,
                              });
                              editForm.setValue(`items.${index}.productVariantId`, v?.id ?? '', {
                                shouldDirty: true,
                              });
                              setEditProductSelections((prev) => ({
                                ...prev,
                                [index]: { product, variant: v },
                              }));
                            } else {
                              setEditProductSelections((prev) => ({
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
                            editForm.setValue(`items.${index}.description`, desc, {
                              shouldDirty: true,
                            });
                            editForm.setValue(`items.${index}.unitPrice`, price, {
                              shouldDirty: true,
                            });
                            editForm.setValue(`items.${index}.productVariantId`, variant.id, {
                              shouldDirty: true,
                            });
                            setEditProductSelections((prev) => ({
                              ...prev,
                              [index]: { product, variant },
                            }));
                          }}
                          onClear={() => {
                            editForm.setValue(`items.${index}.description`, '', {
                              shouldDirty: true,
                            });
                            editForm.setValue(`items.${index}.unitPrice`, 0, { shouldDirty: true });
                            editForm.setValue(`items.${index}.productVariantId`, '', {
                              shouldDirty: true,
                            });
                            setEditProductSelections((prev) => {
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
                              editRemove(index);
                              setEditProductSelections((prev) => {
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
                            editForm.setValue(`items.${index}.description`, desc, {
                              shouldDirty: true,
                            });
                            editForm.setValue(`items.${index}.unitPrice`, price, {
                              shouldDirty: true,
                            });
                            editForm.setValue(`items.${index}.productVariantId`, variant.id, {
                              shouldDirty: true,
                            });
                            setEditProductSelections((prev) => ({
                              ...prev,
                              [index]: { product: sel.product, variant },
                            }));
                          }}
                        />
                      )}
                      <div className="grid grid-cols-4 items-end gap-2">
                        <Input
                          {...editForm.register(`items.${index}.description`)}
                          placeholder="Descripción"
                        />
                        <Input
                          {...editForm.register(`items.${index}.quantity`, { valueAsNumber: true })}
                          type="number"
                          placeholder="Cant."
                        />
                        <Input
                          {...editForm.register(`items.${index}.unitPrice`, {
                            valueAsNumber: true,
                          })}
                          type="number"
                          placeholder="Precio"
                        />
                        <Input
                          {...editForm.register(`items.${index}.discount`, { valueAsNumber: true })}
                          type="number"
                          placeholder="Desc. %"
                          min="0"
                          max="100"
                          step="0.01"
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
                    editAppend({
                      description: '',
                      quantity: 1,
                      unitPrice: 0,
                      productVariantId: '',
                    } as any)
                  }
                >
                  + Agregar item
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <textarea
                  {...editForm.register('notes')}
                  rows={3}
                  className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1"
                />
              </div>
              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                Guardar cambios
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
