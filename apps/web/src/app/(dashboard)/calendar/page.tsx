'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, momentLocalizer, Views, View } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { api } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createEventSchema,
  updateEventSchema,
  type CreateEventInput,
  type UpdateEventInput,
  type EventType,
} from '@nexa/shared';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarDays, Plus, Trash2, Repeat, Copy } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
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

const localizer = momentLocalizer(moment);

type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  type: EventType;
  startDate: string;
  endDate: string;
  allDay: boolean;
  color: string | null;
  location: string | null;
  clientId: string | null;
  clientName: string | null;
  dealId: string | null;
  dealTitle: string | null;
  taskId: string | null;
  taskTitle: string | null;
  isRecurring: boolean;
  recurrenceRule: string | null;
  recurringEventId: string | null;
  recurrenceException: string | null;
};

const EVENT_COLORS: Record<string, string> = {
  MEETING: '#6366f1',
  CALL: '#22c55e',
  TASK: '#f59e0b',
  REMINDER: '#ec4899',
  OTHER: '#6b7280',
};

const TYPE_LABELS: Record<string, string> = {
  MEETING: 'Reunión',
  CALL: 'Llamada',
  TASK: 'Tarea',
  REMINDER: 'Recordatorio',
  OTHER: 'Otro',
};

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'No repetir' },
  { value: 'DAILY', label: 'Diario' },
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'MONTHLY', label: 'Mensual' },
  { value: 'YEARLY', label: 'Anual' },
];

const RECURRENCE_LABELS: Record<string, string> = {
  none: 'No repetir',
  DAILY: 'Diario',
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensual',
  YEARLY: 'Anual',
};

export default function CalendarPage() {
  const [open, setOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [view, setView] = useState<View>(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery<{
    data: CalendarEvent[];
    meta: any;
  }>({
    queryKey: ['events', date.getFullYear(), date.getMonth()],
    queryFn: () => {
      const startOfMonth = moment(date).startOf('month').toISOString();
      const endOfMonth = moment(date).endOf('month').toISOString();
      return api.get('/events', { startDate: startOfMonth, endDate: endOfMonth, limit: '200' });
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateEventInput) => api.post('/events', body),
    onSuccess: () => {
      toast({ title: 'Evento creado', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setOpen(false);
      setEditingEvent(null);
      setSelectedSlot(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateEventInput }) =>
      api.patch(`/events/${id}`, body),
    onSuccess: () => {
      toast({ title: 'Evento actualizado', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setOpen(false);
      setEditingEvent(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/events/${id}`),
    onSuccess: () => {
      toast({ title: 'Evento eliminado', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setOpen(false);
      setEditingEvent(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const form = useForm<CreateEventInput>({
    resolver: zodResolver(createEventSchema),
  });

  const events = useMemo(() => {
    const items = (data?.data || []) as CalendarEvent[];
    return items.map((ev) => ({
      id: ev.id,
      title: ev.title,
      start: new Date(ev.startDate),
      end: new Date(ev.endDate),
      allDay: ev.allDay,
      resource: ev,
    }));
  }, [data]);

  const handleSelectSlot = useCallback(
    (slotInfo: { start: Date; end: Date }) => {
      setSelectedSlot(slotInfo);
      setEditingEvent(null);
      form.reset({
        title: '',
        startDate: slotInfo.start.toISOString(),
        endDate: slotInfo.end.toISOString(),
        allDay: false,
        type: 'MEETING' as any,
        recurrenceRule: 'none',
        recurrenceException: '',
      });
      setOpen(true);
    },
    [form],
  );

  const handleSelectEvent = useCallback(
    (event: any) => {
      const ev = event.resource as CalendarEvent;
      setEditingEvent(ev);
      setSelectedSlot(null);
      form.reset({
        title: ev.title,
        description: ev.description || '',
        type: ev.type as any,
        startDate: ev.startDate,
        endDate: ev.endDate,
        allDay: ev.allDay,
        color: ev.color || '',
        location: ev.location || '',
        clientId: ev.clientId || '',
        dealId: ev.dealId || '',
        taskId: ev.taskId || '',
        recurrenceRule: ev.recurrenceRule || undefined,
        recurrenceException: ev.recurrenceException || '',
      });
      setOpen(true);
    },
    [form],
  );

  const handleSubmit = form.handleSubmit((data) => {
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, body: data });
    } else {
      createMutation.mutate(data);
    }
  });

  const eventPropGetter = useCallback((event: any) => {
    const ev = event.resource as CalendarEvent;
    const color = ev.color || EVENT_COLORS[ev.type] || '#6366f1';
    const isRecurring = ev.isRecurring;
    return {
      style: {
        backgroundColor: color,
        borderColor: color,
        borderRadius: '6px',
        fontSize: '13px',
        borderStyle: isRecurring ? 'dashed' : 'solid',
        borderWidth: isRecurring ? '2px' : '1px',
        backgroundImage: isRecurring
          ? 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.15) 4px, rgba(255,255,255,0.15) 8px)'
          : 'none',
      },
      className: isRecurring ? 'recurring-event' : '',
    };
  }, []);

  return (
    <div className="mx-auto max-w-[1440px] space-y-8">
      <PageHeader
        eyebrow="Agenda"
        numeral={String(events.length).padStart(2, '0')}
        title="Calendario"
        description="Reuniones, llamadas y vencimientos. Click en un día para agendar."
        actions={
          <Button
            variant="ink"
            size="sm"
            onClick={() => {
              setEditingEvent(null);
              setSelectedSlot({ start: new Date(), end: new Date(Date.now() + 3600000) });
              form.reset({
                title: '',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 3600000).toISOString(),
                allDay: false,
                type: 'MEETING' as any,
                recurrenceRule: 'none',
                recurrenceException: '',
              });
              setOpen(true);
            }}
          >
            <Plus className="mr-2 h-3.5 w-3.5" />
            Nuevo evento
          </Button>
        }
      />

      {isError ? (
        <div className="text-alizarin flex h-48 flex-col items-center justify-center gap-3">
          <p>No pudimos cargar tus eventos. {error?.message || 'Error desconocido'}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : isLoading ? (
        <Skeleton className="h-[600px] w-full" />
      ) : (
        <div className="bg-receipt border-ink/14 shadow-recibo overflow-hidden border">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 700 }}
            views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
            defaultView={Views.MONTH}
            view={view}
            date={date}
            onView={(v) => setView(v)}
            onNavigate={(d) => setDate(d)}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={handleSelectEvent}
            selectable
            eventPropGetter={eventPropGetter}
            popup
            formats={{
              eventTimeRangeFormat: () => '',
              agendaTimeRangeFormat: () => '',
            }}
            messages={{
              today: 'Hoy',
              previous: 'Anterior',
              next: 'Siguiente',
              month: 'Mes',
              week: 'Semana',
              day: 'Día',
              agenda: 'Agenda',
              date: 'Fecha',
              time: 'Hora',
              event: 'Evento',
              noEventsInRange: 'No hay eventos en este período',
              showMore: (total) => `+${total} más`,
            }}
          />
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) {
            setOpen(false);
            setEditingEvent(null);
            setSelectedSlot(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingEvent ? 'Editar evento' : 'Nuevo evento'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="eyebrow">Título</Label>
              <Input {...form.register('title')} placeholder="Ej: Llamada con TechCorp" />
              <p className="eyebrow text-alizarin">{form.formState.errors.title?.message}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="eyebrow">Tipo</Label>
                <Select
                  value={form.watch('type')}
                  onValueChange={(v) => form.setValue('type', v as any)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="eyebrow">Repetir</Label>
                <Select
                  value={form.watch('recurrenceRule') || 'none'}
                  onValueChange={(v) =>
                    form.setValue('recurrenceRule', v === 'none' ? undefined : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Frecuencia" />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="eyebrow">Inicio</Label>
                <Input type="datetime-local" {...form.register('startDate')} />
                <p className="eyebrow text-alizarin">{form.formState.errors.startDate?.message}</p>
              </div>
              <div className="space-y-2">
                <Label className="eyebrow">Fin</Label>
                <Input type="datetime-local" {...form.register('endDate')} />
                <p className="eyebrow text-alizarin">{form.formState.errors.endDate?.message}</p>
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
              <Label className="eyebrow">Ubicación</Label>
              <Input {...form.register('location')} placeholder="Ubicación opcional" />
            </div>
            <div className="space-y-2">
              <Label className="eyebrow">Excepciones (EXDATE)</Label>
              <Input
                {...form.register('recurrenceException')}
                placeholder="Fechas a excluir (ISO, separadas por coma): 2026-07-20, 2026-07-27"
                title="Fechas específicas a excluir de la recurrencia, separadas por coma"
              />
              <p className="eyebrow text-ink-3/60">
                Fechas ISO separadas por coma que se excluirán de la recurrencia
              </p>
            </div>
            <Button
              type="submit"
              variant="ink"
              className="w-full"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingEvent ? 'Guardar cambios' : 'Crear evento'}
            </Button>
            {editingEvent && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-alizarin border-alizarin/40 hover:bg-alizarin/10 w-full"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar evento
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar evento?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate(editingEvent.id)}>
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
