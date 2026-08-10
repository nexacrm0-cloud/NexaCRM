'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { timeAgo, cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Activity,
  CheckCircle2,
  XCircle,
  Target,
  FileText,
  ListTodo,
  UserPlus,
  Sparkles,
} from 'lucide-react';

type ActivityItem = {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  user: { firstName: string; lastName: string; avatarUrl: string | null };
};

type ActivityResponse = {
  data: ActivityItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

const TYPE_STYLES: Record<string, { icon: typeof Activity; tone: string }> = {
  'deal.created': { icon: Target, tone: 'text-cobalt' },
  'deal.moved': { icon: Target, tone: 'text-cobalt' },
  'deal.won': { icon: CheckCircle2, tone: 'text-verde' },
  'deal.lost': { icon: XCircle, tone: 'text-alizarin' },
  'client.created': { icon: UserPlus, tone: 'text-cobalt' },
  'task.created': { icon: ListTodo, tone: 'text-naranja' },
  'task.completed': { icon: CheckCircle2, tone: 'text-verde' },
  'quote.created': { icon: FileText, tone: 'text-naranja' },
  'quote.sent': { icon: FileText, tone: 'text-cobalt' },
  'quote.accepted': { icon: CheckCircle2, tone: 'text-naranja' },
  'quote.rejected': { icon: XCircle, tone: 'text-alizarin' },
};

export default function ActivityPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error } = useQuery<ActivityResponse>({
    queryKey: ['activity', page],
    queryFn: () => api.get('/activity', { page: String(page), limit: '20' }),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow="Bitácora"
        numeral={String(data?.meta.total ?? 0).padStart(3, '0')}
        title="Actividad"
        description="Lo que tu equipo fue haciendo. Eventos, no KPIs."
      />

      {isError ? (
        <div className="text-alizarin flex h-48 flex-col items-center justify-center gap-3">
          <p>No pudimos cargar la actividad. {error?.message || 'Error desconocido'}</p>
          <Button variant="outline" size="sm" onClick={() => setPage(1)}>
            Reintentar
          </Button>
        </div>
      ) : isLoading ? (
        <div className="border-ink/14 divide-ink/10 divide-y border">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-receipt flex items-start gap-3 px-4 py-4">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : !data?.data?.length ? (
        <EmptyState
          icon={Activity}
          title="Sin actividad"
          description="Cuando algo pase, lo vas a ver acá."
        />
      ) : (
        <>
          <div className="relative pl-9">
            <div className="bg-ink/22 absolute bottom-3 left-[15px] top-3 w-px" />
            {data.data.map((item) => {
              const typeInfo = TYPE_STYLES[item.type];
              const Icon = typeInfo?.icon ?? Sparkles;
              const tone = typeInfo?.tone ?? 'text-ink-3';
              return (
                <div key={item.id} className="fade-up relative pb-6 last:pb-0">
                  <div className="border-ink bg-paper absolute -left-1 top-0.5 flex h-7 w-7 items-center justify-center border">
                    <Icon className={cn('h-3.5 w-3.5', tone)} strokeWidth={1.7} />
                  </div>
                  <div className="flex items-start gap-3 pl-8">
                    <span
                      className="numeral bg-ink text-paper inline-flex h-7 w-7 shrink-0 items-center justify-center text-[10px]"
                      title={`${item.user.firstName} ${item.user.lastName}`}
                    >
                      {item.user.firstName.charAt(0)}
                      {item.user.lastName.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-sm leading-snug">{item.description}</p>
                      <p className="eyebrow text-ink-3 mt-2">
                        {item.user.firstName} {item.user.lastName} &middot;{' '}
                        {timeAgo(item.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {data?.meta && data.meta.totalPages > 1 && (
            <nav className="flex items-center justify-center gap-3 pt-2" aria-label="Paginación">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
              </Button>
              <span className="eyebrow text-ink-3">
                Página {String(page).padStart(2, '0')} /{' '}
                {String(data.meta.totalPages).padStart(2, '0')}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
