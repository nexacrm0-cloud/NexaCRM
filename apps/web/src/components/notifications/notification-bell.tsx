'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Bell,
  CheckCheck,
  Loader2,
  CheckCircle2,
  XCircle,
  FileText,
  UserPlus,
  Target,
  ListTodo,
  Sparkles,
} from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';

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

const TYPE_ICONS: Record<string, { icon: typeof CheckCircle2; className: string }> = {
  'task.assigned': { icon: ListTodo, className: 'text-blue-400' },
  'task.completed': { icon: CheckCircle2, className: 'text-green-400' },
  'deal.assigned': { icon: Target, className: 'text-purple-400' },
  'deal.won': { icon: CheckCircle2, className: 'text-green-400' },
  'deal.lost': { icon: XCircle, className: 'text-red-400' },
  'quote.sent': { icon: FileText, className: 'text-amber-400' },
  'quote.accepted': { icon: CheckCircle2, className: 'text-green-400' },
  'quote.rejected': { icon: XCircle, className: 'text-red-400' },
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();

  const { user } = useAuth();

  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications', { limit: '10' }),
    enabled: !!user,
    refetchInterval: user ? 30000 : false,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unreadCount = data?.meta?.unreadCount ?? 0;

  const handleClick = (notif: Notification) => {
    if (!notif.isRead) markRead.mutate(notif.id);
    if (notif.link) {
      setOpen(false);
      router.push(notif.link);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="bg-destructive text-destructive-foreground absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Notificaciones</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 text-xs"
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="mr-1 h-3 w-3" /> Marcar todas leídas
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
          ) : !data?.data?.length ? (
            <div className="text-muted-foreground py-8 text-center text-sm">Sin notificaciones</div>
          ) : (
            data.data?.map((notif) => {
              const typeIcon = TYPE_ICONS[notif.type];
              const Icon = typeIcon?.icon ?? Sparkles;
              return (
                <button
                  key={notif.id}
                  className={cn(
                    'hover:bg-secondary/50 w-full border-b px-4 py-3 text-left transition-colors last:border-0',
                    !notif.isRead && 'bg-secondary/30',
                    notif.link && 'cursor-pointer',
                  )}
                  onClick={() => handleClick(notif)}
                >
                  <div className="flex items-start gap-3">
                    <Icon
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0',
                        typeIcon?.className ?? 'text-muted-foreground',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm', !notif.isRead && 'font-semibold')}>
                        {notif.title}
                      </p>
                      {notif.message && (
                        <p className="text-muted-foreground mt-0.5 text-xs">{notif.message}</p>
                      )}
                      <p className="text-muted-foreground mt-1 text-[10px]">
                        {timeAgo(notif.createdAt)}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
