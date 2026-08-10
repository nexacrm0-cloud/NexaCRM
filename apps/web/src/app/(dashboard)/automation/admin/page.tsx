'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Star,
  StarOff,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  DollarSign,
  Activity,
  Layers,
  Wallet,
} from 'lucide-react';

import { api } from '@/lib/api-client';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardEyebrow } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Stamp } from '@/components/ui/stamp';
import { lookupStatus } from '@/components/ui/status-stamps';

type Template = {
  id: string;
  slug: string;
  name: string;
  category: string;
  icon: string | null;
  trigger: string;
  plan: string;
  isFeatured: boolean;
  isPrivate?: boolean;
  installCount: number;
};

type VendorSubscription = {
  id: string;
  templateSlug: string;
  status: string;
  kind: string;
  monthlyPriceCents: number;
  startedAt: string;
  cancelledAt: string | null;
  trialEndsAt: string | null;
  daysToTrialEnd: number | null;
  isLowTrial: boolean;
  customer: {
    organizationId: string;
    organizationName: string | null;
    organizationSlug: string | null;
    organizationPlan: string | null;
  } | null;
};

type VendorSubscriptionsResponse = {
  data: VendorSubscription[];
  summary: {
    active: number;
    paused: number;
    cancelled: number;
    trialing: number;
    mrrCents: number;
    lowTrialAlerts: number;
  };
};

const FEATURED_STAMP = [
  { key: 'ON', tone: 'cobalt' as const, stamp: 'DESTACADO' },
  { key: 'OFF', tone: 'mute' as const, stamp: 'OCULTO' },
];

const VISIBILITY_STAMP = [
  { key: 'PRIVATE', tone: 'alizarin' as const, stamp: 'PRIVADO' },
  { key: 'PUBLIC', tone: 'verde' as const, stamp: 'PÚBLICO' },
];

const SUB_STATUS_STAMPS = [
  { key: 'trialing', tone: 'cobalt' as const, stamp: 'TRIAL' },
  { key: 'active', tone: 'verde' as const, stamp: 'ACTIVA' },
  { key: 'paused', tone: 'alizarin' as const, stamp: 'PAUSADA' },
  { key: 'cancelled', tone: 'mute' as const, stamp: 'CANCELADA' },
];

function formatCents(cents: number) {
  if (!cents) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export default function TemplatesAdminPage() {
  const { canManageSettings } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [pendingMarkPaidId, setPendingMarkPaidId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['workflowTemplatesAdmin'],
    queryFn: () => api.get<{ data: Template[] }>('/automation/templates-admin'),
    enabled: canManageSettings,
  });

  const subsQuery = useQuery({
    queryKey: ['vendorSubscriptions'],
    queryFn: () => api.get<VendorSubscriptionsResponse>('/automation/subscriptions'),
    enabled: canManageSettings,
  });

  const toggleFeatured = useMutation({
    mutationFn: ({ slug, isFeatured }: { slug: string; isFeatured: boolean }) =>
      api.patch<Template>(`/automation/templates/${encodeURIComponent(slug)}/featured`, {
        isFeatured,
      }),
    onMutate: (vars) => {
      setPendingSlug(vars.slug);
    },
    onSettled: () => setPendingSlug(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowTemplatesAdmin'] });
      queryClient.invalidateQueries({ queryKey: ['workflowTemplates'] });
      toast({ title: 'Cambios guardados' });
    },
    onError: (err: Error) =>
      toast({ title: 'No pudimos guardarlo', description: err.message, variant: 'destructive' }),
  });

  const togglePrivate = useMutation({
    mutationFn: ({ slug, isPrivate }: { slug: string; isPrivate: boolean }) =>
      api.patch<Template>(`/automation/templates-admin/${encodeURIComponent(slug)}/visibility`, {
        isPrivate,
      }),
    onMutate: (vars) => setPendingSlug(vars.slug),
    onSettled: () => setPendingSlug(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflowTemplatesAdmin'] });
      queryClient.invalidateQueries({ queryKey: ['workflowTemplates'] });
      toast({ title: 'Visibilidad actualizada' });
    },
    onError: (err: Error) =>
      toast({ title: 'No pudimos actualizarla', description: err.message, variant: 'destructive' }),
  });

  const markPaid = useMutation({
    mutationFn: (id: string) =>
      api.post<{ data: { id: string; status: string } }>('/automation-admin/mark-paid', { id }),
    onMutate: (id) => setPendingMarkPaidId(id),
    onSettled: () => setPendingMarkPaidId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendorSubscriptions'] });
      toast({ title: 'Suscripción marcada como pagada' });
    },
    onError: (err: Error) =>
      toast({ title: 'No pudimos marcarla', description: err.message, variant: 'destructive' }),
  });

  const templates = data?.data ?? [];
  const featured = useMemo(() => templates.filter((t) => t.isFeatured), [templates]);

  const subs = subsQuery.data?.data ?? [];
  const summary = subsQuery.data?.summary ?? {
    active: 0,
    paused: 0,
    cancelled: 0,
    trialing: 0,
    mrrCents: 0,
    lowTrialAlerts: 0,
  };
  const lowTrials = subs.filter((s) => s.isLowTrial);

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <PageHeader
        eyebrow="Owner only"
        title="Gestor de automatizaciones"
        description="MRR, alertas de trial, suscripciones de clientes y featured del marketplace."
      />

      {!canManageSettings ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={ShieldCheck}
              title="Acceso restringido"
              description="Esta sección está reservada para administradores del workspace."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* SAAS DASHBOARD — MRR + counts */}
          <section className="border-ink/14 bg-ink/14 fade-up grid gap-px border md:grid-cols-4">
            <div className="bg-receipt px-5 py-5">
              <p className="eyebrow text-ink-3 inline-flex items-center gap-1.5">
                <Wallet className="h-3 w-3" strokeWidth={1.5} />
                MRR
              </p>
              <p className="numeral text-naranja tabular mt-3 text-[36px]">
                {formatCents(summary.mrrCents)}
              </p>
              <p className="eyebrow text-ink-3 mt-2">Recurring mensual</p>
            </div>
            <div className="bg-receipt px-5 py-5">
              <p className="eyebrow text-ink-3 inline-flex items-center gap-1.5">
                <Activity className="h-3 w-3" strokeWidth={1.5} />
                Activas
              </p>
              <p className="numeral text-verde tabular mt-3 text-[36px]">
                {String(summary.active).padStart(2, '0')}
              </p>
              <p className="eyebrow text-ink-3 mt-2">Cobrando hoy</p>
            </div>
            <div className="bg-receipt px-5 py-5">
              <p className="eyebrow text-ink-3 inline-flex items-center gap-1.5">
                <Layers className="h-3 w-3" strokeWidth={1.5} />
                En trial
              </p>
              <p className="numeral text-cobalt tabular mt-3 text-[36px]">
                {String(summary.trialing).padStart(2, '0')}
              </p>
              <p className="eyebrow text-ink-3 mt-2">Aún sin cobrar</p>
            </div>
            <div className="bg-receipt px-5 py-5">
              <p className="eyebrow text-ink-3 inline-flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3" strokeWidth={1.5} />
                Trials críticos
              </p>
              <p
                className={`numeral tabular mt-3 text-[36px] ${
                  summary.lowTrialAlerts > 0 ? 'text-alizarin' : 'text-ink-3'
                }`}
              >
                {String(summary.lowTrialAlerts).padStart(2, '0')}
              </p>
              <p className="eyebrow text-ink-3 mt-2">≤ 3 días para fin</p>
            </div>
          </section>

          {/* LOW-TRIAL ALERTS */}
          {lowTrials.length > 0 && (
            <Card className="fade-up border-alizarin/40">
              <CardEyebrow className="eyebrow text-alizarin flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.7} />
                  Trials a punto de expirar
                </span>
                <Stamp tone="alizarin" size="sm" rotate={-1.5}>
                  ACCIÓN
                </Stamp>
              </CardEyebrow>
              <CardContent className="pt-5">
                <ul className="space-y-2">
                  {lowTrials.map((s) => (
                    <li
                      key={s.id}
                      className="border-ink/14 bg-receipt flex flex-wrap items-center justify-between gap-3 border px-4 py-3"
                    >
                      <div>
                        <p className="font-display text-[15px]">
                          {s.customer?.organizationName ?? 'Cliente sin nombre'}
                        </p>
                        <p className="eyebrow text-ink-3 mt-0.5">
                          {s.templateSlug} · finaliza en {s.daysToTrialEnd}d
                        </p>
                      </div>
                      <Button
                        variant="ink"
                        size="sm"
                        disabled={pendingMarkPaidId === s.id}
                        onClick={() => markPaid.mutate(s.id)}
                      >
                        {pendingMarkPaidId === s.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <DollarSign className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.7} />
                        )}
                        Activar pago
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* VENDOR SUBSCRIPTIONS TABLE */}
          <Card className="fade-up">
            <CardEyebrow className="eyebrow flex items-center justify-between">
              <span>Suscripciones de clientes ({subs.length})</span>
              <Stamp tone="cobalt" size="sm" rotate={-2}>
                VENDOR
              </Stamp>
            </CardEyebrow>
            <CardContent className="overflow-x-auto pt-5">
              {subsQuery.isLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-ink/10 h-8 animate-pulse" />
                  ))}
                </div>
              ) : subs.length === 0 ? (
                <p className="eyebrow text-ink-3 py-6">
                  Sin suscripciones todavía. Cuando un cliente instala o recibes una transferencia,
                  aparece acá.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-receipt border-ink/14 text-ink-3 border-b">
                    <tr>
                      <th className="eyebrow px-3 py-2.5 text-left">Cliente</th>
                      <th className="eyebrow px-3 py-2.5 text-left">Plantilla</th>
                      <th className="eyebrow px-3 py-2.5 text-left">Estado</th>
                      <th className="eyebrow px-3 py-2.5 text-right">Costo</th>
                      <th className="eyebrow px-3 py-2.5 text-right">Trial</th>
                      <th className="eyebrow px-3 py-2.5 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subs.map((s) => {
                      const st = lookupStatus(SUB_STATUS_STAMPS, s.status);
                      return (
                        <tr
                          key={s.id}
                          className="bg-receipt border-ink/10 hover:bg-paper-2 border-b transition-colors last:border-b-0"
                        >
                          <td className="font-display px-3 py-3 text-[15px]">
                            {s.customer?.organizationName ?? '—'}
                            <span className="eyebrow text-ink-3 mt-0.5 block">
                              {s.customer?.organizationPlan ?? '—'}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-mono text-[11px]">{s.templateSlug}</td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-2">
                              <Stamp tone={st.tone} size="sm" rotate={-1}>
                                {st.stamp}
                              </Stamp>
                              {s.isLowTrial && (
                                <span className="eyebrow text-alizarin">≤ {s.daysToTrialEnd}d</span>
                              )}
                            </span>
                          </td>
                          <td className="tabular px-3 py-3 text-right">
                            {formatCents(s.monthlyPriceCents)}
                          </td>
                          <td className="tabular text-ink-3 px-3 py-3 text-right">
                            {s.status === 'trialing' ? `${s.daysToTrialEnd ?? '—'}d` : '—'}
                          </td>
                          <td className="px-3 py-3 text-right">
                            {(s.status === 'trialing' || s.status === 'paused') && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={pendingMarkPaidId === s.id}
                                onClick={() => markPaid.mutate(s.id)}
                              >
                                {pendingMarkPaidId === s.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  'Marcar pagada'
                                )}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* TEMPLATE MANAGER */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-receipt border-ink/14 space-y-2 border p-4">
                  <div className="bg-ink/10 h-4 w-40 animate-pulse" />
                  <div className="bg-ink/10 h-3 w-24 animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <Card className="fade-up mt-6">
                <CardEyebrow className="eyebrow flex items-center justify-between">
                  <span>Destacados activos ({featured.length})</span>
                  <Stamp tone="cobalt" size="sm" rotate={-2}>
                    PUBLICADOS
                  </Stamp>
                </CardEyebrow>
                <CardContent>
                  {featured.length === 0 ? (
                    <p className="eyebrow text-ink-3">
                      Sin destacados. Flipeá el switch en alguna plantilla para destacarla.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {featured.map((t) => (
                        <li
                          key={t.id}
                          className="border-ink/14 bg-receipt flex items-center justify-between border px-4 py-3"
                        >
                          <div>
                            <p className="font-display text-[16px]">{t.name}</p>
                            <p className="eyebrow text-ink-3 mt-0.5">
                              {t.category} · {t.trigger} · {t.installCount} instalaciones
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              toggleFeatured.mutate({ slug: t.slug, isFeatured: false })
                            }
                            disabled={pendingSlug === t.slug}
                          >
                            {pendingSlug === t.slug ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <StarOff className="h-3.5 w-3.5" />
                            )}
                            Quitar destacado
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card className="fade-up mt-6">
                <CardEyebrow className="eyebrow flex items-center justify-between">
                  <span>Catálogo completo</span>
                  <span className="eyebrow text-ink-3">Ordenado por nombre</span>
                </CardEyebrow>
                <CardContent className="overflow-x-auto pt-5">
                  <table className="w-full text-sm">
                    <thead className="bg-receipt border-ink/14 text-ink-3 border-b">
                      <tr>
                        <th className="eyebrow px-4 py-2.5 text-left">Plantilla</th>
                        <th className="eyebrow px-4 py-2.5 text-left">Categoría</th>
                        <th className="eyebrow px-4 py-2.5 text-left">Trigger</th>
                        <th className="eyebrow px-4 py-2.5 text-right">Inst.</th>
                        <th className="eyebrow px-4 py-2.5 text-right">Estado</th>
                        <th className="eyebrow px-4 py-2.5 text-right">Visibilidad</th>
                        <th className="eyebrow px-4 py-2.5 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templates.map((t) => {
                        const s = lookupStatus(FEATURED_STAMP, t.isFeatured ? 'ON' : 'OFF');
                        const v = lookupStatus(
                          VISIBILITY_STAMP,
                          t.isPrivate ? 'PRIVATE' : 'PUBLIC',
                        );
                        return (
                          <tr
                            key={t.id}
                            className="bg-receipt border-ink/10 hover:bg-paper-2 border-b transition-colors last:border-b-0"
                          >
                            <td className="font-display px-4 py-3 text-[15px]">{t.name}</td>
                            <td className="eyebrow text-ink-3 px-4 py-3">{t.category}</td>
                            <td className="px-4 py-3">
                              <span className="border-ink/22 border px-1.5 py-0.5 font-mono text-[11px]">
                                {t.trigger}
                              </span>
                            </td>
                            <td className="tabular px-4 py-3 text-right">{t.installCount}</td>
                            <td className="px-4 py-3 text-right">
                              <Stamp tone={s.tone} size="sm" rotate={t.isFeatured ? -2 : 1.5}>
                                {s.stamp}
                              </Stamp>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex items-center justify-end gap-2">
                                <Stamp tone={v.tone} size="sm" rotate={t.isPrivate ? -1 : 1.5}>
                                  {v.stamp}
                                </Stamp>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    togglePrivate.mutate({
                                      slug: t.slug,
                                      isPrivate: !t.isPrivate,
                                    })
                                  }
                                  disabled={pendingSlug === t.slug}
                                  aria-label={t.isPrivate ? 'Hacer público' : 'Hacer privado'}
                                >
                                  {t.isPrivate ? 'Hacer público' : 'Hacer privado'}
                                </Button>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                variant={t.isFeatured ? 'outline' : 'ink'}
                                size="sm"
                                onClick={() =>
                                  toggleFeatured.mutate({
                                    slug: t.slug,
                                    isFeatured: !t.isFeatured,
                                  })
                                }
                                disabled={pendingSlug === t.slug}
                              >
                                {pendingSlug === t.slug ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : t.isFeatured ? (
                                  <>
                                    <StarOff className="mr-1 h-3.5 w-3.5" />
                                    Quitar
                                  </>
                                ) : (
                                  <>
                                    <Star className="mr-1 h-3.5 w-3.5" />
                                    Destacar
                                  </>
                                )}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
