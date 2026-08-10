'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardEyebrow } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stamp } from '@/components/ui/stamp';
import { PageHeader } from '@/components/layout/page-header';
import {
  Building2,
  ShieldCheck,
  ChevronLeft,
  Settings2,
  Zap,
  Wrench,
  ArrowRight,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { CompanySize, SupportStatus } from '@nexa/shared';

type OrganizationDetails = {
  id: string;
  name: string;
  slug: string;
  companySize: CompanySize;
  supportStatus: SupportStatus;
  plan: string;
  lastRunAt: string | null;
  workflowCount: number;
};

const SUPPORT_STAMPS: Record<
  string,
  { tone: 'ink' | 'cobalt' | 'naranja' | 'verde' | 'alizarin' | 'mute'; stamp: string }
> = {
  ACTIVE: { tone: 'verde', stamp: 'ACTIVO' },
  EXPIRED: { tone: 'alizarin', stamp: 'VENCIDO' },
  PENDING_RENEWAL: { tone: 'naranja', stamp: 'POR RENOVAR' },
  SUSPENDED: { tone: 'mute', stamp: 'SUSPENDIDO' },
};

export default function OrgSupportPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['support-org', id],
    queryFn: () => api.get<OrganizationDetails>(`/support/organizations/${id}`),
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: SupportStatus) =>
      api.patch(`/support/organizations/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['support-org', id] }),
  });

  const updateSizeMutation = useMutation({
    mutationFn: (size: CompanySize) => api.patch(`/support/organizations/${id}/size`, { size }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['support-org', id] }),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1280px] py-12">
        <div className="bg-receipt border-ink/14 h-12 w-80 animate-pulse border" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="font-display text-alizarin">No se encontró la organización.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/support')}
          className="mt-4"
        >
          <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Volver al listado
        </Button>
      </div>
    );
  }

  const statusInfo = SUPPORT_STAMPS[data.supportStatus] ?? {
    tone: 'mute' as const,
    stamp: data.supportStatus,
  };

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Volver
        </Button>
        <span className="eyebrow text-ink-3">Soporte · {data.slug}</span>
      </div>

      <div className="border-ink/22 fade-up flex flex-col gap-3 border-b pb-6">
        <p className="eyebrow">Organización</p>
        <h1 className="font-display text-[44px] leading-[1.04] tracking-[-0.025em]">{data.name}</h1>
        <div className="mt-1 flex items-center gap-2">
          <span className="eyebrow text-ink-3 border-ink/22 border px-1.5 py-0.5">
            {data.companySize === 'SME' ? 'PYME' : 'Enterprise'}
          </span>
          <span className="text-ink-3 font-mono text-[11px]">{data.plan}</span>
        </div>
      </div>

      <section className="fade-up grid gap-6 lg:grid-cols-3" style={{ animationDelay: '60ms' }}>
        <Card>
          <CardEyebrow className="eyebrow flex items-center justify-between">
            <span>01 · Estado de soporte</span>
            <ShieldCheck className="text-ink-3 h-3.5 w-3.5" strokeWidth={1.5} />
          </CardEyebrow>
          <CardContent className="space-y-4 pt-5">
            <Stamp tone={statusInfo.tone} size="md" rotate={-1.5}>
              {statusInfo.stamp}
            </Stamp>
            <div className="border-ink/14 grid grid-cols-2 gap-2 border-t pt-2">
              {(['ACTIVE', 'EXPIRED', 'PENDING_RENEWAL', 'SUSPENDED'] as SupportStatus[]).map(
                (s) => {
                  const active = data.supportStatus === s;
                  return (
                    <Button
                      key={s}
                      variant={active ? 'ink' : 'outline'}
                      size="sm"
                      className="text-[11px]"
                      onClick={() => updateStatusMutation.mutate(s)}
                    >
                      {s === 'ACTIVE'
                        ? 'Activar'
                        : s === 'EXPIRED'
                          ? 'Vencer'
                          : s === 'PENDING_RENEWAL'
                            ? 'Pendiente'
                            : 'Suspender'}
                    </Button>
                  );
                },
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardEyebrow className="eyebrow flex items-center justify-between">
            <span>02 · Segmento</span>
            <Building2 className="text-ink-3 h-3.5 w-3.5" strokeWidth={1.5} />
          </CardEyebrow>
          <CardContent className="space-y-4 pt-5">
            <p className="numeral tabular text-[28px]">
              {data.companySize === 'SME' ? 'PYME' : 'Enterprise'}
            </p>
            <p className="eyebrow text-ink-3">Tamaño de la empresa</p>
            <div className="border-ink/14 grid grid-cols-2 gap-2 border-t pt-2">
              <Button
                variant={data.companySize === CompanySize.SME ? 'ink' : 'outline'}
                size="sm"
                className="text-[11px]"
                onClick={() => updateSizeMutation.mutate(CompanySize.SME)}
              >
                PYME
              </Button>
              <Button
                variant={data.companySize === CompanySize.ENTERPRISE ? 'ink' : 'outline'}
                size="sm"
                className="text-[11px]"
                onClick={() => updateSizeMutation.mutate(CompanySize.ENTERPRISE)}
              >
                Enterprise
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardEyebrow className="eyebrow flex items-center justify-between">
            <span>03 · Automatizaciones</span>
            <Zap className="text-ink-3 h-3.5 w-3.5" strokeWidth={1.5} />
          </CardEyebrow>
          <CardContent className="space-y-4 pt-5">
            <div>
              <p className="eyebrow text-ink-3">Flujos activos</p>
              <p className="numeral text-naranja tabular text-[36px]">{data.workflowCount}</p>
            </div>
            <div className="border-ink/14 border-t pt-3">
              <p className="eyebrow text-ink-3">Última ejecución</p>
              <p className="mt-1 font-mono text-sm">
                {data.lastRunAt ? new Date(data.lastRunAt).toLocaleString() : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="fade-up" style={{ animationDelay: '180ms' }}>
        <CardEyebrow className="eyebrow flex items-center justify-between">
          <span>04 · Panel de control del cliente</span>
          <Settings2 className="text-ink-3 h-3.5 w-3.5" strokeWidth={1.5} />
        </CardEyebrow>
        <CardContent className="pt-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-md space-y-1">
              <p className="text-sm">
                Entrás en la organización del cliente con tus credenciales de super admin. Toda
                acción queda registrada en el Audit Log con tu usuario.
              </p>
            </div>
            <Button
              variant="ink"
              size="sm"
              onClick={() => {
                sessionStorage.setItem('support_org_id', data.id);
                router.push('/dashboard');
              }}
            >
              <Wrench className="mr-2 h-3.5 w-3.5" />
              Acceder al CRM
              <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
