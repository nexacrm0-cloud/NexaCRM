'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Stamp } from '@/components/ui/stamp';
import { TASK_STATUS_LIST, PRIORITY_LIST, lookupStatus } from '@/components/ui/status-stamps';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePermissions } from '@/hooks/use-permissions';
import { formatDate, timeAgo } from '@/lib/utils';
import { Plus, CheckCircle2, Circle, Clock, Pencil, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createTaskSchema,
  updateTaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
  TaskPriority,
  TaskStatus,
} from '@nexa/shared';
import { ClientSelect } from '@/components/ui/client-select';

type TasksResponse = {
  data: Array<{
    id: string;
    title: string;
    description: string | null;
    priority: string;
    status: string;
    dueDate: string | null;
    createdAt: string;
    assignee: { id: string; firstName: string; lastName: string; avatarUrl: string | null } | null;
    client: { id: string; companyName: string } | null;
    deal: { id: string; title: string } | null;
  }>;
  meta: { total: number; page: number; limit: number; totalPages: number };
};

export default function TasksPage() {
  const [open, setOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TasksResponse['data'][0] | null>(null);
  const [filter, setFilter] = useState<string>('');
  const queryClient = useQueryClient();
  const { canCreate, canEdit, canDelete } = usePermissions();

  const { data, isLoading, isError, error, refetch } = useQuery<TasksResponse>({
    queryKey: ['tasks', filter],
    queryFn: () => api.get('/tasks', { status: filter || undefined, limit: '50' }),
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateTaskInput) => api.post('/tasks', body),
    onSuccess: () => {
      toast({ title: 'Tarea creada', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateTaskInput }) =>
      api.patch(`/tasks/${id}`, body),
    onSuccess: () => {
      toast({ title: 'Tarea actualizada', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setEditingTask(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/tasks/${id}/complete`),
    onSuccess: () => {
      toast({ title: 'Tarea completada', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/tasks/${id}`),
    onSuccess: () => {
      toast({ title: 'Tarea eliminada', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const form = useForm<CreateTaskInput>({
    resolver: zodResolver(createTaskSchema),
  });

  const editForm = useForm<UpdateTaskInput>({
    resolver: zodResolver(updateTaskSchema),
  });

  const openEdit = (task: TasksResponse['data'][0]) => {
    setEditingTask(task);
    editForm.reset({
      title: task.title,
      description: task.description || '',
      priority: task.priority as TaskPriority,
      status: task.status as TaskStatus,
      dueDate: task.dueDate || '',
      clientId: task.client?.id || '',
    });
  };

  const tasks = data?.data || [];

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <PageHeader
        eyebrow="Pendientes"
        numeral={String(
          tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'DONE').length,
        ).padStart(2, '0')}
        title="Tareas"
        description="Lo que hoy hay que hacer. Lo que estaba pendiente, lo que se hizo."
        actions={
          canCreate ? (
            <Button variant="ink" size="sm" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-3.5 w-3.5" />
              Nueva tarea
            </Button>
          ) : undefined
        }
      />

      {canCreate && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Nueva tarea</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label className="eyebrow">Título</Label>
                <Input {...form.register('title')} placeholder="Ej: Llamar a TechCorp" />
                <p className="eyebrow text-alizarin">{form.formState.errors.title?.message}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="eyebrow">Prioridad</Label>
                  <Select onValueChange={(v) => form.setValue('priority', v as TaskPriority)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar prioridad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Baja</SelectItem>
                      <SelectItem value="MEDIUM">Media</SelectItem>
                      <SelectItem value="HIGH">Alta</SelectItem>
                      <SelectItem value="URGENT">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="eyebrow text-alizarin">{form.formState.errors.priority?.message}</p>
                </div>
                <div className="space-y-2">
                  <Label className="eyebrow">Fecha límite</Label>
                  <Input type="datetime-local" {...form.register('dueDate')} />
                  <p className="eyebrow text-alizarin">{form.formState.errors.dueDate?.message}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="eyebrow">Descripción</Label>
                <textarea
                  {...form.register('description')}
                  placeholder="Descripción opcional"
                  rows={3}
                  className="border-border/40 bg-paper placeholder:text-ink-3/60 focus-visible:ring-cobalt flex w-full rounded-[2px] border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1"
                />
              </div>
              <div className="space-y-2">
                <Label className="eyebrow">Cliente (opcional)</Label>
                <ClientSelect
                  value={form.watch('clientId') || ''}
                  onChange={(v) => form.setValue('clientId', v)}
                />
              </div>
              <Button
                type="submit"
                variant="ink"
                className="w-full"
                disabled={createMutation.isPending}
              >
                Crear tarea
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {['', 'PENDING', 'IN_PROGRESS', 'COMPLETED'].map((s) => {
          const active = filter === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`shrink-0 border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors ${
                active
                  ? 'border-ink bg-ink text-paper'
                  : 'border-ink/14 text-ink-2 hover:border-ink/40'
              }`}
            >
              {s === ''
                ? 'Todas'
                : s === 'PENDING'
                  ? 'Pendientes'
                  : s === 'IN_PROGRESS'
                    ? 'En curso'
                    : 'Hechas'}
            </button>
          );
        })}
      </div>

      {isError ? (
        <div className="text-alizarin flex h-48 flex-col items-center justify-center gap-3">
          <p>No pudimos cargar las tareas. {error?.message || 'Error desconocido'}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : isLoading ? (
        <div className="border-ink/14 space-y-px border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-receipt space-y-2 px-4 py-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No hay tareas"
          description={
            filter
              ? 'Ninguna tarea en este filtro.'
              : 'Sin pendientes por hoy. Sumá la primera cuando aparezca.'
          }
          action={
            canCreate && !filter ? (
              <Button onClick={() => setOpen(true)} variant="ink">
                <Plus className="mr-2 h-3.5 w-3.5" />
                Nueva tarea
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="border-ink/14 bg-paper-2 border">
          {tasks.map((task) => {
            const s = lookupStatus(TASK_STATUS_LIST, task.status);
            const p = lookupStatus(PRIORITY_LIST, task.priority);
            const completed = task.status === 'COMPLETED' || task.status === 'DONE';
            return (
              <li
                key={task.id}
                className="bg-receipt border-ink/10 hover:bg-paper-2 fade-up flex items-start gap-3 border-b px-4 py-4 transition-colors last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => !completed && completeMutation.mutate(task.id)}
                  disabled={!canEdit || completed}
                  aria-label={completed ? 'Tarea completada' : 'Marcar como hecha'}
                  className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center border ${
                    completed
                      ? 'border-verde text-verde cursor-default'
                      : 'border-ink/30 hover:border-ink text-ink-3 hover:text-ink'
                  }`}
                >
                  {completed ? (
                    <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
                  ) : (
                    <Circle className="h-4 w-4" strokeWidth={1.5} />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-display text-[16px] leading-snug ${completed ? 'text-ink-3 line-through' : ''}`}
                      >
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-ink-3 mt-1 line-clamp-2 text-xs">{task.description}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {task.assignee && (
                        <span
                          className="numeral bg-paper-2 border-ink/14 text-ink inline-flex h-7 w-7 items-center justify-center border text-[10px]"
                          title={`${task.assignee.firstName} ${task.assignee.lastName}`}
                        >
                          {task.assignee.firstName.charAt(0)}
                          {task.assignee.lastName.charAt(0)}
                        </span>
                      )}
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-ink-3 hover:text-ink h-7 w-7"
                          onClick={() => openEdit(task)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canDelete && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-ink-3 hover:text-alizarin h-7 w-7"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(task.id)}>
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Stamp tone={s.tone} size="sm" rotate={-2}>
                      {s.stamp}
                    </Stamp>
                    <Stamp tone={p.tone} size="sm" rotate={1.5}>
                      {p.stamp}
                    </Stamp>
                    {task.dueDate && (
                      <span className="eyebrow text-ink-3">Vence · {formatDate(task.dueDate)}</span>
                    )}
                    {task.client && (
                      <span className="eyebrow text-ink-3">· {task.client.companyName}</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog
        open={!!editingTask}
        onOpenChange={(o) => {
          if (!o) setEditingTask(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Editar tarea</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={editForm.handleSubmit((data) => {
              if (editingTask) updateMutation.mutate({ id: editingTask.id, body: data });
            })}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label className="eyebrow">Título</Label>
              <Input {...editForm.register('title')} placeholder="Título de la tarea" />
              <p className="eyebrow text-alizarin">{editForm.formState.errors.title?.message}</p>
            </div>
            <div className="space-y-2">
              <Label className="eyebrow">Prioridad</Label>
              <Select
                value={editForm.watch('priority')}
                onValueChange={(v) => editForm.setValue('priority', v as TaskPriority)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Baja</SelectItem>
                  <SelectItem value="MEDIUM">Media</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                  <SelectItem value="URGENT">Urgente</SelectItem>
                </SelectContent>
              </Select>
              <p className="eyebrow text-alizarin">{editForm.formState.errors.priority?.message}</p>
            </div>
            <div className="space-y-2">
              <Label className="eyebrow">Descripción</Label>
              <textarea
                {...editForm.register('description')}
                placeholder="Descripción opcional"
                rows={3}
                className="border-border/40 bg-paper placeholder:text-ink-3/60 focus-visible:ring-cobalt flex w-full rounded-[2px] border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1"
              />
            </div>
            <div className="space-y-2">
              <Label className="eyebrow">Fecha límite</Label>
              <Input type="datetime-local" {...editForm.register('dueDate')} />
              <p className="eyebrow text-alizarin">{editForm.formState.errors.dueDate?.message}</p>
            </div>
            <div className="space-y-2">
              <Label className="eyebrow">Cliente (opcional)</Label>
              <ClientSelect
                value={editForm.watch('clientId') || ''}
                onChange={(v) => editForm.setValue('clientId', v)}
              />
            </div>
            <Button
              type="submit"
              variant="ink"
              className="w-full"
              disabled={updateMutation.isPending}
            >
              Guardar cambios
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
