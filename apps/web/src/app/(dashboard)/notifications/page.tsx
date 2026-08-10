'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { cn, timeAgo } from '@/lib/utils';
import {
  CheckCheck,
  CheckCircle2,
  XCircle,
  FileText,
  Target,
  ListTodo,
  Sparkles,
  BellOff,
} from 'lucide-react';

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

type NotificationsResponse = {
  data: Notification[];
  meta: { total: number; unreadCount: number };
};

const TYPE_STYLES: Record<string, { icon: typeof CheckCircle2; tone: string; label: string }> = {
  'task.assigned': { icon: ListTodo, tone: 'text-cobalt', label: 'Tarea asignada' },
  'task.completed': { icon: CheckCircle2, tone: 'text-verde', label: 'Tarea completada' },
  'deal.assigned': { icon: Target, tone: 'text-naranja', label: 'Oportunidad asignada' },
  'deal.won': { icon: CheckCircle2, tone: 'text-verde', label: 'Negocio ganado' },
  'deal.lost': { icon: XCircle, tone: 'text-alizarin', label: 'Negocio perdido' },
  'quote.sent': { icon: FileText, tone: 'text-cobalt', label: 'Presupuesto enviado' },
  'quote.accepted': { icon: CheckCircle2, tone: 'text-naranja', label: 'Presupuesto aceptado' },
  'quote.rejected': { icon: XCircle, tone: 'text-alizarin', label: 'Presupuesto rechazado' },
};

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ['notifications', filter],
    queryFn: () =>
      api.get('/notifications', {
        limit: '50',
        ...(filter === 'unread' ? { unread: 'true' } : {}),
      }),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      toast({ title: 'Notificaciones marcadas como leídas', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const unreadCount = data?.meta?.unreadCount ?? 0;
  const notifications = data?.data ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow="Bandeja"
        numeral={String(unreadCount).padStart(2, '0')}
        title="Notificaciones"
        description={
          unreadCount > 0
            ? `${unreadCount} sin leer. El resto, ya está leído.`
            : 'Todo al día. No hay nada pendiente.'
        }
        actions={
          unreadCount > 0 ? (
            <Button variant="ink" size="sm" onClick={() => markAllRead.mutate()}>
              <CheckCheck className="mr-2 h-3.5 w-3.5" />
              Marcar todas leídas
            </Button>
          ) : undefined
        }
      />

      <div className="flex gap-2">
        {(['all', 'unread'] as const).map((f) => {
          const active = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors ${
                active
                  ? 'border-ink bg-ink text-paper'
                  : 'border-ink/14 text-ink-2 hover:border-ink/40'
              }`}
            >
              {f === 'all' ? 'Todas' : 'No leídas'}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="border-ink/14 divide-ink/10 divide-y border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-receipt flex items-start gap-3 p-4">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={filter === 'unread' ? CheckCheck : BellOff}
          title={filter === 'unread' ? 'No hay notificaciones sin leer' : 'No hay notificaciones'}
          description={
            filter === 'unread'
              ? 'Todo al día. Marcá todas y cerrá la bandeja.'
              : 'Cuando pase algo, va a aparecer acá.'
          }
        />
      ) : (
        <ul className="border-ink/14 bg-paper-2 border">
          {notifications.map((notif) => {
            const typeInfo = TYPE_STYLES[notif.type];
            const Icon = typeInfo?.icon ?? Sparkles;
            const tone = typeInfo?.tone ?? 'text-ink-3';
            return (
              <li
                key={notif.id}
                onClick={() => {
                  if (!notif.isRead) markRead.mutate(notif.id);
                }}
                className={cn(
                  'bg-receipt border-ink/10 hover:bg-paper-2 fade-up cursor-pointer border-b px-4 py-4 transition-colors last:border-b-0',
                  !notif.isRead && 'border-l-naranja border-l-2',
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'inline-flex h-8 w-8 shrink-0 items-center justify-center border',
                      notif.isRead
                        ? 'border-ink/14 bg-paper text-ink-3'
                        : 'border-ink bg-receipt text-ink',
                    )}
                  >
                    <Icon className={cn('h-4 w-4', tone)} strokeWidth={1.7} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'text-sm leading-snug',
                            !notif.isRead && 'text-ink font-semibold',
                          )}
                        >
                          {notif.title}
                        </p>
                        {notif.message && (
                          <p className="text-ink-3 mt-1 text-xs">{notif.message}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="eyebrow text-ink-3">{typeInfo?.label ?? notif.type}</span>
                        {!notif.isRead && (
                          <span className="numeral text-naranja text-[9px] uppercase tracking-[0.18em]">
                            Nuevo
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="eyebrow text-ink-3 mt-2">{timeAgo(notif.createdAt)}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
