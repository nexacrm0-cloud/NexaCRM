'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  Receipt,
  Trash2,
  Zap,
  BadgeCheck,
  Calendar,
  Activity,
  ExternalLink,
} from 'lucide-react';

import { api } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardEyebrow } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Stamp } from '@/components/ui/stamp';
import { lookupStatus } from '@/components/ui/status-stamps';

type Subscription = {
  id: string;
  templateSlug: string;
  templateName: string;
  templateCategory: string | null;
  templateDescription: string | null;
  templateIcon: string | null;
  status: string;
  kind: string;
  monthlyPriceCents: number;
  startedAt: string;
  billingCycleEndsAt: string | null;
  cancelledAt: string | null;
  trialEndsAt: string | null;
  daysToTrialEnd: number | null;
  daysToRenewal: number | null;
  workflow: {
    id: string;
    isActive: boolean;
    trigger: string;
    lastRunAt: string | null;
    lastRunStatus: string | null;
  } | null;
};

const STATUS_STAMPS = [
  { key: 'trialing', tone: 'cobalt' as const, stamp: 'EN PRUEBA' },
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

function relativeTime(date: string | null): string {
  if (!date) return 'recién';
  const diffMs = Date.now() - new Date(date).getTime();
  if (diffMs < 60 * 1000) return 'recién';
  const min = Math.floor(diffMs / (60 * 1000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} d`;
  return new Date(date).toLocaleDateString('es-AR');
}

export default function CustomerSubscriptionsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['myAutomationSubscriptions'],
    queryFn: () => api.get<{ data: Subscription[] }>('/automation/my/subscriptions'),
  });

  const checkoutMutation = useMutation({
    mutationFn: (templateSlug: string) =>
      api.post<{ data: { approvalUrl: string; amountCents: number; externalId: string } }>(
        '/automation/my/subscriptions/start-checkout',
        { templateSlug },
      ),
    onSuccess: (res) => {
      if (res.data.approvalUrl) {
        // SECURITY C4: validate the host/scheme returned by the backend
        // before navigating. Even if the API is compromised or reflected
        // user input, we refuse to redirect to arbitrary external hosts.
        try {
          const u = new URL(res.data.approvalUrl);
          const allowedHosts = [
            'paypal.com',
            'www.paypal.com',
            'stripe.com',
            'checkout.stripe.com',
            'mercadopago.com',
            'www.mercadopago.com',
          ];
          const hostOk =
            u.protocol === 'https:' &&
            (allowedHosts.includes(u.hostname) ||
              allowedHosts.some((h) => u.hostname.endsWith('.' + h)));
          if (!hostOk) {
            toast({ title: 'URL de pago no permitida', variant: 'destructive' });
            return;
          }
          window.location.href = res.data.approvalUrl;
        } catch {
          toast({ title: 'URL de pago inválida', variant: 'destructive' });
        }
      } else {
        toast({ title: 'Sin URL de pago', variant: 'destructive' });
      }
    },
    onError: (err: Error) =>
      toast({
        title: 'No pudimos iniciar el checkout',
        description: err.message,
        variant: 'destructive',
      }),
  });

  const cancelMutation = useMutation({
    mutationFn: (templateSlug: string) =>
      api.post<{ data: { id: string; status: string; cancelledAt: string } }>(
        '/automation/my/subscriptions/cancel',
        { templateSlug },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myAutomationSubscriptions'] });
      toast({ title: 'Suscripción cancelada' });
    },
    onError: (err: Error) =>
      toast({ title: 'No pudimos cancelarla', description: err.message, variant: 'destructive' }),
  });

  const subs = data?.data ?? [];

  return (
    <div className="mx-auto max-w-[1100px] space-y-8">
      <PageHeader
        eyebrow="Mis automatizaciones"
        title="Suscripciones"
        description="Activá, pagá o cancelá las automatizaciones que tenés contratadas."
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-5">
                <div className="bg-ink/10 h-4 w-40 animate-pulse" />
                <div className="bg-ink/10 h-3 w-24 animate-pulse" />
                <div className="bg-ink/10 h-3 w-full animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : subs.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={Zap}
              title="Sin automatizaciones contratadas"
              description="Cuando alguien te active una automatización, vas a poder verla y pagarla acá."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2" data-testid="customer-subs">
          {subs.map((sub) => {
            const s = lookupStatus(STATUS_STAMPS, sub.status);
            const isTrial = sub.status === 'trialing';
            const isActive = sub.status === 'active';
            const isCancelled = sub.status === 'cancelled';
            return (
              <Card key={sub.id} className="fade-up">
                <CardEyebrow className="eyebrow flex items-center justify-between">
                  <span>{sub.templateCategory ?? 'Automatización'}</span>
                  <Stamp tone={s.tone} size="sm" rotate={-2}>
                    {s.stamp}
                  </Stamp>
                </CardEyebrow>
                <CardContent className="space-y-4 pt-5">
                  <div>
                    <h3 className="font-display text-[20px] leading-tight">{sub.templateName}</h3>
                    <p className="eyebrow text-ink-3 mt-1 font-mono">{sub.templateSlug}</p>
                  </div>

                  {sub.templateDescription && (
                    <p className="text-ink-3 text-sm leading-relaxed">{sub.templateDescription}</p>
                  )}

                  {sub.workflow && (
                    <div className="border-ink/14 bg-receipt space-y-1.5 border px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="eyebrow text-ink-3 inline-flex items-center gap-1.5">
                          <Activity className="h-3 w-3" strokeWidth={1.5} />
                          Qué corre
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          {sub.workflow.isActive && sub.status !== 'cancelled' ? (
                            <Stamp tone="verde" size="sm" rotate={-1}>
                              ACTIVO
                            </Stamp>
                          ) : (
                            <Stamp tone="mute" size="sm" rotate={1}>
                              DETENIDO
                            </Stamp>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[12px]">
                        <span className="text-ink-3 font-mono">{sub.workflow.trigger}</span>
                        <span className="text-ink-3">
                          {sub.workflow.lastRunAt ? (
                            <>
                              Últ. run{' '}
                              <span
                                className={`${
                                  sub.workflow.lastRunStatus === 'COMPLETED'
                                    ? 'text-verde'
                                    : sub.workflow.lastRunStatus === 'FAILED'
                                      ? 'text-alizarin'
                                      : 'text-ink-3'
                                }`}
                              >
                                {relativeTime(sub.workflow.lastRunAt)}
                              </span>
                            </>
                          ) : (
                            <span className="text-ink-3">sin ejecutar</span>
                          )}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="border-ink/14 -mb-1 w-full border"
                        onClick={() => router.push('/automation')}
                      >
                        <ExternalLink className="mr-1.5 h-3 w-3" strokeWidth={1.5} />
                        Ver automatización
                      </Button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="border-ink/14 bg-receipt border px-3 py-2">
                      <p className="eyebrow text-ink-3">Costo</p>
                      <p className="font-display mt-1 text-[18px]">
                        {formatCents(sub.monthlyPriceCents)}
                        <span className="eyebrow text-ink-3">/mes</span>
                      </p>
                    </div>
                    {isTrial && sub.trialEndsAt && (
                      <div className="border-cobalt/40 bg-cobalt/10 border px-3 py-2">
                        <p className="eyebrow text-cobalt">Trial</p>
                        <p className="font-display text-cobalt mt-1 text-[18px]">
                          {sub.daysToTrialEnd}d
                        </p>
                      </div>
                    )}
                    {isActive && sub.daysToRenewal !== null && (
                      <div className="border-verde/40 bg-verde/10 border px-3 py-2">
                        <p className="eyebrow text-verde">Próxima cuota</p>
                        <p className="font-display text-verde mt-1 text-[18px]">
                          {sub.daysToRenewal}d
                        </p>
                      </div>
                    )}
                  </div>

                  {isCancelled && sub.cancelledAt && (
                    <div className="border-ink/14 bg-receipt border px-3 py-2">
                      <p className="eyebrow text-ink-3">Cancelada el</p>
                      <p className="mt-1 text-sm">
                        {new Date(sub.cancelledAt).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {(isTrial || (isActive && sub.kind === 'trial')) && (
                      <Button
                        variant="ink"
                        size="sm"
                        className="flex-1"
                        disabled={
                          checkoutMutation.isPending &&
                          checkoutMutation.variables === sub.templateSlug
                        }
                        onClick={() => checkoutMutation.mutate(sub.templateSlug)}
                      >
                        {checkoutMutation.isPending &&
                        checkoutMutation.variables === sub.templateSlug ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Receipt className="mr-2 h-3.5 w-3.5" />
                        )}
                        Pagar {formatCents(sub.monthlyPriceCents)}/mes
                      </Button>
                    )}
                    {isActive && sub.kind === 'paid' && (
                      <div className="border-verde/40 bg-verde/10 flex flex-1 items-center justify-between gap-2 border px-3 py-2">
                        <span className="eyebrow text-verde inline-flex items-center gap-1.5">
                          <BadgeCheck className="h-3 w-3" />
                          Pagada y activa
                        </span>
                        <Calendar className="text-verde h-3 w-3" />
                      </div>
                    )}
                    {(isTrial || isActive) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-ink-3 hover:text-alizarin"
                        onClick={() => cancelMutation.mutate(sub.templateSlug)}
                        disabled={cancelMutation.isPending}
                        aria-label="Cancelar"
                      >
                        {cancelMutation.isPending &&
                        cancelMutation.variables === sub.templateSlug ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
