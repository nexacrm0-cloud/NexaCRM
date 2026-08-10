'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardEyebrow } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { timeAgo, formatDate } from '@/lib/utils';
import { useFormatCurrency } from '@/hooks/use-format-currency';
import { DollarSign, Users, Target, CheckSquare, TrendingUp, Activity } from 'lucide-react';
import { SalesTrendChart } from '@/components/charts/sales-trend-chart';
import { PipelineFunnel } from '@/components/charts/pipeline-funnel';

type DashboardData = {
  data: {
    monthlySales: number;
    newClients: number;
    openOpportunities: number;
    pendingTasks: number;
    recentActivity: Array<{
      id: string;
      type: string;
      description: string;
      createdAt: string;
      user: { firstName: string; lastName: string; avatarUrl: string | null };
      client?: { companyName: string } | null;
      deal?: { title: string } | null;
      task?: { title: string } | null;
    }>;
    wonDeals: Array<{
      id: string;
      title: string;
      value: number;
      client: { companyName: string };
      stage: { name: string };
      assignee: { firstName: string; lastName: string };
    }>;
  };
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.get<DashboardData>('/dashboard/summary'),
  });
  const formatCurrency = useFormatCurrency();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-7 w-40" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="col-span-full lg:col-span-2">
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-[250px] w-full" />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-[250px] w-full" />
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-48" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="bg-secondary/50 flex items-center justify-between rounded-lg p-3"
                >
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-destructive flex h-48 flex-col items-center justify-center gap-3">
        <p>Error al cargar datos: {error?.message || 'Error desconocido'}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  // Backend devuelve el shape plano (no envuelto). Soporte retrocompatible si el
  // backend se reinició y vuelve con `{ data: ... }` mientras el bundle se reconstruye.
  const rawData = data as any;
  const summary = rawData?.data ?? rawData;
  if (!summary) return null;

  const stats = [
    {
      kind: 'currency',
      title: 'Ventas del mes',
      value: summary.monthlySales,
      icon: DollarSign,
      numeral: '01',
    },
    {
      kind: 'count',
      title: 'Clientes nuevos',
      value: summary.newClients,
      icon: Users,
      numeral: '02',
    },
    {
      kind: 'count',
      title: 'Oportunidades abiertas',
      value: summary.openOpportunities,
      icon: Target,
      numeral: '03',
    },
    {
      kind: 'count',
      title: 'Tareas pendientes',
      value: summary.pendingTasks,
      icon: CheckSquare,
      numeral: '04',
    },
  ];

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <PageHeader
        eyebrow="Resumen"
        numeral="01"
        title={user ? `Hola, ${user.firstName}` : 'Tu negocio hoy'}
        description={
          user?.lastLoginAt
            ? `Último acceso: ${formatDate(user.lastLoginAt)}`
            : 'Tus números, en limpio. Sin fraude.'
        }
        actions={
          <>
            <Button variant="outline" size="sm">
              Exportar
            </Button>
            <Button variant="ink" size="sm">
              Nueva factura
            </Button>
          </>
        }
      />

      <section
        aria-label="Indicadores"
        className="border-ink/14 bg-ink/14 grid gap-px border md:grid-cols-2 lg:grid-cols-4"
      >
        {stats.map((stat, index) => (
          <article
            key={stat.title}
            className="bg-receipt fade-up px-5 py-6"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <div className="flex items-start justify-between">
              <p className="eyebrow">
                {stat.numeral} · {stat.title.toUpperCase()}
              </p>
              <stat.icon className="text-ink-3 h-4 w-4" strokeWidth={1.5} />
            </div>
            <p className="numeral text-ink mt-6 text-[44px] leading-none">
              {stat.kind === 'currency'
                ? formatCurrency(Number(stat.value))
                : Number(stat.value).toLocaleString('es-AR')}
            </p>
            <p className="eyebrow text-ink-3 mt-3">
              {stat.kind === 'currency' ? 'AR$' : 'ESTE MES'}
            </p>
          </article>
        ))}
      </section>

      <section className="fade-up grid gap-6 lg:grid-cols-3" style={{ animationDelay: '240ms' }}>
        <div className="lg:col-span-2">
          <SalesTrendChart />
        </div>
        <div>
          <PipelineFunnel />
        </div>
      </section>

      <section className="fade-up grid gap-6 lg:grid-cols-2" style={{ animationDelay: '320ms' }}>
        <Card>
          <CardEyebrow className="eyebrow flex items-center justify-between">
            <span>01 · Ganados de julio</span>
            <TrendingUp className="text-ink-3 h-3.5 w-3.5" strokeWidth={1.5} />
          </CardEyebrow>
          <CardHeader className="pb-3 pt-0">
            <CardTitle>Negocios ganados</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.wonDeals?.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="Todavía no cerrás ninguno"
                description="Cuando cierres tu primer negocio del mes, aparecerá acá."
              />
            ) : (
              <ul className="divide-ink/10 divide-y">
                {summary.wonDeals?.map((deal: any) => (
                  <li key={deal.id} className="flex items-baseline justify-between py-3">
                    <div className="space-y-1">
                      <p className="font-display text-[17px] leading-tight">{deal.title}</p>
                      <p className="text-ink-3 text-xs">
                        {deal.client.companyName} &middot; {deal.assignee.firstName}{' '}
                        {deal.assignee.lastName}
                      </p>
                    </div>
                    <span className="numeral text-naranja text-[17px]">
                      {formatCurrency(Number(deal.value))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardEyebrow className="eyebrow flex items-center justify-between">
            <span>02 · Actividad del equipo</span>
            <Activity className="text-ink-3 h-3.5 w-3.5" strokeWidth={1.5} />
          </CardEyebrow>
          <CardHeader className="pb-3 pt-0">
            <CardTitle>Actividad reciente</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.recentActivity?.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="Sin actividad reciente"
                description="Cuando tu equipo se mueva, va a aparecer acá."
              />
            ) : (
              <ul className="space-y-4">
                {summary.recentActivity?.slice(0, 8).map((activity: any) => (
                  <li key={activity.id} className="flex items-start gap-3">
                    <span className="numeral bg-ink text-paper inline-flex h-7 w-7 shrink-0 items-center justify-center text-[11px]">
                      {activity.user.firstName.charAt(0)}
                      {activity.user.lastName.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">{activity.description}</p>
                      <p className="eyebrow text-ink-3 mt-1">{timeAgo(activity.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
