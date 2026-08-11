'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardEyebrow } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Stamp } from '@/components/ui/stamp';
import { PageHeader } from '@/components/layout/page-header';
import { CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Plan = {
  id: string;
  name: string;
  price: number;
  priceArs?: number;
  currency: string;
  interval: string;
  features: string[];
};

function formatPlanPrice(plan: Plan) {
  if (plan.priceArs) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(plan.priceArs);
  }
  return `${plan.currency} ${plan.price}`;
}

type CurrentPlanData = {
  currentPlan: Plan;
};

type CheckoutData = {
  data: {
    approvalUrl: string | null;
    externalId: string;
    plan: string;
    amountCents: number;
  };
};

const PLAN_BADGES: Record<
  string,
  { tone: 'mute' | 'cobalt' | 'naranja' | 'verde'; stamp: string } | null
> = {
  free: null,
  starter: { tone: 'cobalt', stamp: 'POPULAR' },
  pro: { tone: 'naranja', stamp: 'MÁS ELEGIDO' },
  enterprise: { tone: 'verde', stamp: 'MÁXIMO' },
};

export default function PricingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [changing, setChanging] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  useEffect(() => {
    setCheckoutSuccess(new URLSearchParams(window.location.search).get('checkout') === 'success');
  }, []);

  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.get<Plan[]>('/subscriptions/plans'),
  });

  const { data: currentPlanData } = useQuery({
    queryKey: ['current-plan'],
    queryFn: () => api.get<CurrentPlanData>('/subscriptions/current'),
  });

  const changePlanMutation = useMutation({
    mutationFn: (plan: string) => api.post('/subscriptions/change', { plan }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-plan'] });
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
      setChanging(null);
    },
    onError: (err: Error) => {
      setError(err.message);
      setChanging(null);
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: (plan: string) => api.post<CheckoutData>('/subscriptions/checkout', { plan }),
    onSuccess: (data) => {
      if (data?.data?.approvalUrl) {
        window.location.href = data.data.approvalUrl;
      }
    },
    onError: (err: Error) => {
      setError(err.message);
      setChanging(null);
    },
  });

  const currentPlanId = currentPlanData?.currentPlan?.id ?? 'free';

  function handleSelectPlan(planId: string) {
    if (!user) {
      router.push('/login');
      return;
    }
    if (planId === currentPlanId) return;
    setError(null);
    setChanging(planId);
    if (planId === 'free') {
      changePlanMutation.mutate(planId);
    } else {
      checkoutMutation.mutate(planId);
    }
  }

  return (
    <div className="bg-paper min-h-screen">
      <div className="mx-auto max-w-[1440px] space-y-12 px-6 py-16 md:py-24">
        <header className="fade-up text-center">
          <p className="eyebrow mx-auto inline-flex items-center gap-2">Planes y precios</p>
          <h1
            className="font-display mt-4 text-[56px] leading-[1.05] tracking-[-0.025em]"
            style={{ textWrap: 'balance' }}
          >
            Elegí el plan que se ajusta a tu negocio
          </h1>
          <p className="text-ink-3 mx-auto mt-4 max-w-xl">
            Desde un CRM básico hasta agentes de IA que operan 24/7. Cambiá de plan cuando quieras,
            sin letra chica.
          </p>
        </header>

        {checkoutSuccess ? (
          <div className="border-verde bg-verde/10 mx-auto max-w-2xl border px-5 py-4 text-center">
            <p className="text-verde text-sm font-semibold">
              Pago confirmado. Tu plan se actualizó.
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="mx-auto max-w-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-center">
            <p className="text-sm font-semibold text-red-600">{error}</p>
          </div>
        ) : null}

        <section
          className="border-ink/14 bg-ink/14 fade-up grid grid-cols-1 gap-px border md:grid-cols-2 lg:grid-cols-4"
          style={{ animationDelay: '60ms' }}
        >
          {plans?.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            const isChanging = changing === plan.id;
            const badge = PLAN_BADGES[plan.id];

            return (
              <article
                key={plan.id}
                className={`bg-receipt relative flex flex-col p-6 md:p-7 ${isCurrent ? 'ring-naranja ring-1 ring-inset' : ''}`}
              >
                <CardEyebrow className="eyebrow flex items-center justify-between">
                  <span>Plan</span>
                  {badge ? (
                    <Stamp tone={badge.tone} size="sm" rotate={-1.5}>
                      {badge.stamp}
                    </Stamp>
                  ) : isCurrent ? (
                    <Stamp tone="naranja" size="sm" rotate={1.5}>
                      TU PLAN
                    </Stamp>
                  ) : null}
                </CardEyebrow>

                <h3 className="font-display mt-4 text-[22px] leading-tight">{plan.name}</h3>

                <div className="mt-5">
                  {plan.price === 0 ? (
                    <p className="font-display tabular text-[36px] tracking-[-0.02em]">Gratis</p>
                  ) : (
                    <p className="font-display tabular text-[36px] tracking-[-0.02em]">
                      <span>{formatPlanPrice(plan)}</span>
                      <span className="eyebrow text-ink-3 ml-2 align-baseline">
                        /{plan.interval === 'month' ? 'mes' : 'año'}
                      </span>
                    </p>
                  )}
                </div>

                <CardContent className="flex-1 px-0 pt-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <CheckCircle2
                          className={`mt-0.5 h-4 w-4 shrink-0 ${isCurrent ? 'text-naranja' : 'text-verde'}`}
                          strokeWidth={1.7}
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <div className="border-ink/14 mt-6 border-t pt-5">
                  {isCurrent ? (
                    <Button variant="outline" className="w-full text-[11px]" disabled>
                      Plan actual
                    </Button>
                  ) : (
                    <Button
                      variant="ink"
                      className="w-full text-[11px]"
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={isChanging}
                    >
                      {isChanging ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : plan.price === 0 && currentPlanId !== 'free' ? (
                        'Degradar a gratis'
                      ) : (
                        <>
                          {plan.price > 0 && currentPlanId === 'free' ? 'Upgrade' : 'Cambiar plan'}
                          <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </section>

        <footer className="fade-up text-center" style={{ animationDelay: '180ms' }}>
          <p className="eyebrow text-ink-3">
            Todos los planes incluyen soporte, actualizaciones y sin permanencia mínima.
          </p>
          <p className="eyebrow text-ink-3 mt-3">
            ¿Algo especial?{' '}
            <a
              href="mailto:hola@nexa.com.ar"
              className="text-naranja underline-offset-2 hover:underline"
            >
              Contactanos
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
