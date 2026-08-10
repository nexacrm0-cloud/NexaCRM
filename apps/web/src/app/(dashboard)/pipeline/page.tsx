'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFormatCurrency } from '@/hooks/use-format-currency';
import { usePermissions } from '@/hooks/use-permissions';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { Plus, User, Trash2 } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createDealSchema,
  updateDealSchema,
  type CreateDealInput,
  type UpdateDealInput,
} from '@nexa/shared';

type Stage = {
  id: string;
  name: string;
  position: number;
  color: string;
  isWinStage: boolean;
  isLoseStage: boolean;
};

type Deal = {
  id: string;
  title: string;
  value: number;
  currency: string;
  probability: number;
  stageId: string;
  stage: { id: string; name: string; color: string };
  client: { id: string; companyName: string; contactName: string } | null;
  assignee: { firstName: string; lastName: string; avatarUrl: string | null } | null;
  createdAt: string;
};

export default function PipelinePage() {
  const [open, setOpen] = useState(false);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const formatCurrency = useFormatCurrency();

  const { data: stages } = useQuery<Stage[]>({
    queryKey: ['pipeline-stages'],
    queryFn: () => api.get('/pipeline/stages'),
  });

  const {
    data: dealsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Deal[]>({
    queryKey: ['pipeline-deals', searchFilter, Array.from(selectedIds).length > 0],
    queryFn: () =>
      api.get('/pipeline/deals', {
        search: searchFilter || undefined,
      }),
  });

  const { data: forecast } = useQuery<{
    openDealsCount: number;
    openValue: number;
    weightedForecast: number;
    staleDealsCount: number;
    wonLast30d: number;
    monthly: Array<{ month: string; weighted: number }>;
  }>({
    queryKey: ['pipeline-forecast'],
    queryFn: () => api.get('/pipeline/forecast'),
    refetchInterval: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateDealInput) => api.post('/pipeline/deals', body),
    onSuccess: () => {
      toast({ title: 'Oportunidad creada', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['pipeline-deals'] });
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ ids, stageId }: { ids: string[]; stageId: string }) =>
      api.patch('/pipeline/deals/bulk-move', { ids, stageId }),
    onMutate: async ({ ids, stageId }) => {
      // Optimistic move: update cache immediately
      await queryClient.cancelQueries({ queryKey: ['pipeline-deals'] });
      const previous = queryClient.getQueryData<Deal[]>(['pipeline-deals']);
      queryClient.setQueryData<Deal[]>(['pipeline-deals'], (old) =>
        old?.map((d) => (ids.includes(d.id) ? { ...d, stageId } : d)),
      );
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['pipeline-deals'], context.previous);
      }
      toast({
        title: 'Error al mover oportunidad',
        description: err.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-deals'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-forecast'] });
      setSelectedIds(new Set());
    },
  });

  const handleDragStart = useCallback(
    (e: React.DragEvent, dealId: string) => {
      if (!canEdit) {
        e.preventDefault();
        return;
      }
      // If user multi-selected with checkboxes and starts drag from one card,
      // bring the whole selection along.
      const payload = selectedIds.has(dealId) ? Array.from(selectedIds) : [dealId];
      e.dataTransfer.setData('application/json', JSON.stringify({ ids: payload }));
      e.dataTransfer.setData('dealId', dealId);
      e.dataTransfer.effectAllowed = 'move';
    },
    [canEdit, selectedIds],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, stageId: string) => {
      e.preventDefault();
      setDragOverStage(null);
      const json = e.dataTransfer.getData('application/json');
      let ids: string[] = [];
      if (json) {
        try {
          const parsed = JSON.parse(json);
          if (Array.isArray(parsed?.ids)) ids = parsed.ids;
        } catch {
          /* fallthrough */
        }
      }
      if (ids.length === 0) {
        const single = e.dataTransfer.getData('dealId');
        if (single) ids = [single];
      }
      if (ids.length > 0) {
        moveMutation.mutate({ ids, stageId });
      }
    },
    [moveMutation],
  );

  const toggleSelect = useCallback((dealId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(dealId)) {
        next.delete(dealId);
      } else {
        next.add(dealId);
      }
      return next;
    });
  }, []);

  const updateDealMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateDealInput }) =>
      api.patch(`/pipeline/deals/${id}`, body),
    onSuccess: () => {
      toast({ title: 'Oportunidad actualizada', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['pipeline-deals'] });
      setSelectedDeal(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/pipeline/deals/${id}`),
    onSuccess: () => {
      toast({ title: 'Oportunidad eliminada', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['pipeline-deals'] });
      setSelectedDeal(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const form = useForm<CreateDealInput>({
    resolver: zodResolver(createDealSchema),
    defaultValues: { stageId: '' },
  });

  const editDealForm = useForm<UpdateDealInput>({
    resolver: zodResolver(updateDealSchema),
  });

  useEffect(() => {
    if (selectedDeal) {
      editDealForm.reset({
        title: selectedDeal.title,
        value: Number(selectedDeal.value),
        stageId: selectedDeal.stageId,
      });
    }
  }, [selectedDeal, editDealForm]);

  const selectedStageId = form.watch('stageId');

  const groupedDeals = dealsData?.reduce(
    (acc, deal) => {
      if (!acc[deal.stageId]) acc[deal.stageId] = [];
      acc[deal.stageId]!.push(deal);
      return acc;
    },
    {} as Record<string, Deal[]>,
  );

  if (isError) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <div className="text-alizarin flex h-48 flex-col items-center justify-center gap-3">
          <p>No pudimos cargar las oportunidades. {error?.message || 'Error desconocido'}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <PageHeader
        eyebrow="Embudo"
        numeral={String(dealsData?.length ?? 0).padStart(2, '0')}
        title="Pipeline"
        description="Cada columna es una parada. Arrastrá una oportunidad a la siguiente etapa cuando cambian de estado."
        actions={
          canCreate ? (
            <Button variant="ink" size="sm" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-3.5 w-3.5" />
              Nueva oportunidad
            </Button>
          ) : undefined
        }
      />

      {forecast && (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <Card className="p-4">
            <p className="eyebrow">Forecast ponderado</p>
            <p className="font-fraunces tabular text-ink mt-1 text-[28px]">
              {formatCurrency(Number(forecast.weightedForecast))}
            </p>
            <p className="eyebrow text-ink-3 mt-2">
              {forecast.openDealsCount} abiertas · {forecast.wonLast30d} ganadas (30d)
            </p>
          </Card>
          <Card className="p-4">
            <p className="eyebrow">Pipeline abierto</p>
            <p className="font-fraunces tabular text-ink mt-1 text-[28px]">
              {formatCurrency(Number(forecast.openValue))}
            </p>
            <p className="eyebrow text-ink-3 mt-2">valor nominal sin probabilidad</p>
          </Card>
          <Card className="p-4">
            <p className="eyebrow">Dealings</p>
            <p className="font-fraunces tabular text-ink mt-1 text-[28px]">{forecast.wonLast30d}</p>
            <p className="eyebrow text-ink-3 mt-2">won en los últimos 30 días</p>
          </Card>
          <Card className="p-4">
            <p className="eyebrow">Estancados</p>
            <p
              className={`font-fraunces tabular mt-1 text-[28px] ${forecast.staleDealsCount > 0 ? 'text-alizarin' : 'text-verde'}`}
            >
              {forecast.staleDealsCount}
            </p>
            <p className="eyebrow text-ink-3 mt-2">{'closeDate > 14 días atrás'}</p>
          </Card>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Input
            placeholder="Buscar oportunidad, cliente..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>
        {selectedIds.size > 0 && (
          <div className="text-eyebrow flex items-center gap-2">
            <span className="eyebrow">{selectedIds.size} seleccionadas</span>
            <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
              Limpiar
            </Button>
          </div>
        )}
      </div>

      {canCreate && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Nueva oportunidad</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label className="eyebrow">Título</Label>
                <Input {...form.register('title')} placeholder="Nombre de la oportunidad" />
                <p className="eyebrow text-alizarin">{form.formState.errors.title?.message}</p>
              </div>
              <div className="space-y-2">
                <Label className="eyebrow">Valor</Label>
                <Input
                  type="number"
                  {...form.register('value', { valueAsNumber: true })}
                  placeholder="15000"
                />
                <p className="eyebrow text-alizarin">{form.formState.errors.value?.message}</p>
              </div>
              <div className="space-y-2">
                <Label className="eyebrow">Etapa</Label>
                <Select
                  value={selectedStageId}
                  onValueChange={(v) => form.setValue('stageId', v, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages?.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="eyebrow text-alizarin">{form.formState.errors.stageId?.message}</p>
              </div>
              <Button
                type="submit"
                variant="ink"
                className="w-full"
                disabled={createMutation.isPending}
              >
                Crear oportunidad
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {isLoading ? (
        <div className="border-ink/14 flex gap-px overflow-x-auto border pb-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="bg-receipt min-w-[280px] flex-shrink-0 space-y-2 p-3">
              <Skeleton className="h-7 w-24" />
              {[...Array(3)].map((_, j) => (
                <Skeleton key={j} className="h-24 w-full" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div
          className="border-ink/14 bg-ink/14 flex gap-px overflow-x-auto border pb-4"
          style={{ minHeight: 'calc(100vh - 280px)' }}
        >
          {stages?.map((stage) => {
            const stageDeals = groupedDeals?.[stage.id] ?? [];
            const totalValue = stageDeals.reduce((acc, d) => acc + Number(d.value), 0);
            return (
              <section
                key={stage.id}
                className={`bg-receipt min-w-[280px] flex-shrink-0 transition-colors ${
                  dragOverStage === stage.id ? 'bg-paper-2' : ''
                }`}
                onDragOver={(e) => {
                  if (!canEdit) return;
                  e.preventDefault();
                  setDragOverStage(stage.id);
                }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={(e) => {
                  if (!canEdit) return;
                  handleDrop(e, stage.id);
                }}
              >
                <header className="border-ink/14 flex items-center justify-between border-b p-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: stage.color }}
                      aria-hidden
                    />
                    <span className="font-display truncate text-[14px]">{stage.name}</span>
                  </div>
                  <span className="numeral text-ink-3 tabular text-[11px]">
                    {String(stageDeals.length).padStart(2, '0')}
                  </span>
                </header>
                {stageDeals.length > 0 && (
                  <div className="border-ink/14 bg-paper-2 border-b px-3 py-2">
                    <p className="eyebrow text-ink-3 mb-0.5">Total etapa</p>
                    <p className="numeral text-naranja tabular text-[17px]">
                      {formatCurrency(totalValue)}
                    </p>
                  </div>
                )}
                <div className="bg-ink/14 min-h-[120px] space-y-px p-2">
                  {stageDeals.length > 0 ? (
                    stageDeals.map((deal) => {
                      const isSelected = selectedIds.has(deal.id);
                      return (
                        <article
                          key={deal.id}
                          draggable={canEdit}
                          onDragStart={(e) => {
                            if (canEdit) handleDragStart(e, deal.id);
                          }}
                          onClick={() => setSelectedDeal(deal)}
                          className={`bg-receipt hover:bg-paper-2 fade-up relative cursor-pointer p-3 transition-colors ${
                            isSelected ? 'ring-naranja ring-2' : ''
                          }`}
                        >
                          {canEdit && (
                            <button
                              type="button"
                              onClick={(e) => toggleSelect(deal.id, e)}
                              aria-label={
                                isSelected ? `Quitar ${deal.title}` : `Seleccionar ${deal.title}`
                              }
                              className={`absolute right-2 top-2 h-4 w-4 border ${
                                isSelected
                                  ? 'bg-ink border-ink'
                                  : 'bg-paper border-ink/30 hover:border-ink/60'
                              } flex items-center justify-center`}
                            >
                              {isSelected && (
                                <span className="text-paper text-[10px] leading-none">×</span>
                              )}
                            </button>
                          )}
                          <p className="font-display mb-1 line-clamp-2 pr-6 text-[14px] leading-snug">
                            {deal.title}
                          </p>
                          {deal.client && (
                            <p className="eyebrow text-ink-3 mb-2 truncate">
                              {deal.client.companyName}
                            </p>
                          )}
                          <div className="border-ink/10 flex items-center justify-between border-t pt-2">
                            <span className="numeral text-naranja tabular text-[15px]">
                              {formatCurrency(Number(deal.value), deal.currency)}
                            </span>
                            {deal.assignee ? (
                              <span
                                className="numeral bg-ink text-paper inline-flex h-6 w-6 items-center justify-center text-[10px]"
                                title={`${deal.assignee.firstName} ${deal.assignee.lastName}`}
                              >
                                {deal.assignee.firstName.charAt(0)}
                                {deal.assignee.lastName.charAt(0)}
                              </span>
                            ) : (
                              <span className="border-ink/14 text-ink-3 inline-flex h-6 w-6 items-center justify-center border">
                                <User className="h-3 w-3" strokeWidth={1.5} />
                              </span>
                            )}
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <p className="eyebrow text-ink-3 py-8 text-center">Arrastrá una oportunidad</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!selectedDeal}
        onOpenChange={(open) => {
          if (!open) setSelectedDeal(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{selectedDeal?.title}</DialogTitle>
          </DialogHeader>
          {selectedDeal && (
            <form
              onSubmit={
                canEdit
                  ? editDealForm.handleSubmit((data) =>
                      updateDealMutation.mutate({ id: selectedDeal.id, body: data }),
                    )
                  : (e) => e.preventDefault()
              }
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label className="eyebrow">Título</Label>
                <Input {...editDealForm.register('title')} disabled={!canEdit} />
                <p className="eyebrow text-alizarin">
                  {editDealForm.formState.errors.title?.message}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="eyebrow">Valor</Label>
                <Input
                  type="number"
                  {...editDealForm.register('value', { valueAsNumber: true })}
                  disabled={!canEdit}
                />
                <p className="eyebrow text-alizarin">
                  {editDealForm.formState.errors.value?.message}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="eyebrow">Etapa</Label>
                <Select
                  value={editDealForm.watch('stageId')}
                  onValueChange={(v) =>
                    canEdit && editDealForm.setValue('stageId', v, { shouldValidate: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar etapa" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages?.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="eyebrow text-alizarin">
                  {editDealForm.formState.errors.stageId?.message}
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                {canEdit && (
                  <Button
                    type="submit"
                    variant="ink"
                    className="flex-1"
                    disabled={updateDealMutation.isPending}
                  >
                    Guardar cambios
                  </Button>
                )}
                {canDelete && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="text-alizarin hover:text-alizarin">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar oportunidad?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            if (!selectedDeal) return;
                            deleteMutation.mutate(selectedDeal.id);
                          }}
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
