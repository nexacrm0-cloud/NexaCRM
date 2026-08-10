'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardEyebrow } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stamp } from '@/components/ui/stamp';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Building2, ShieldCheck, AlertTriangle, ArrowRight, Search, Settings2 } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { CompanySize, SupportStatus } from '@nexa/shared';

type OrganizationSupport = {
  id: string;
  name: string;
  slug: string;
  companySize: CompanySize;
  supportStatus: SupportStatus;
  plan: string;
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

const SUPPORT_LABELS: Record<SupportStatus, string> = {
  ACTIVE: 'Activo',
  EXPIRED: 'Vencido',
  PENDING_RENEWAL: 'Por renovar',
  SUSPENDED: 'Suspendido',
};

export default function SupportPage() {
  const { canManageSettings } = usePermissions();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['support-organizations'],
    queryFn: () => api.get<OrganizationSupport[]>('/support/organizations'),
  });

  if (!canManageSettings) {
    return (
      <div className="fade-up mx-auto max-w-md py-16">
        <EmptyState
          icon={ShieldCheck}
          title="Acceso restringido"
          description="Solo el equipo de soporte de Nexa entra a esta sección."
        />
      </div>
    );
  }

  const filteredOrgs =
    data?.filter(
      (org) =>
        org.name.toLowerCase().includes(search.toLowerCase()) ||
        org.slug.toLowerCase().includes(search.toLowerCase()),
    ) || [];

  const totalOrgs = data?.length ?? 0;
  const expiredCount = data?.filter((org) => org.supportStatus === 'EXPIRED').length ?? 0;
  const enterpriseCount = data?.filter((org) => org.companySize === 'ENTERPRISE').length ?? 0;

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <PageHeader
        eyebrow="Soporte"
        numeral={String(totalOrgs).padStart(2, '0')}
        title="Panel de soporte"
        description="El CRM visto desde adentro: a quién hay que asistir hoy, qué cuenta está por caducar."
      />

      <section
        className="border-ink/14 bg-ink/14 fade-up grid gap-px border md:grid-cols-3"
        style={{ animationDelay: '60ms' }}
      >
        <article className="bg-receipt px-5 py-5">
          <p className="eyebrow text-ink-3">01 · Empresas</p>
          <p className="numeral tabular mt-3 text-[36px]">{String(totalOrgs).padStart(2, '0')}</p>
          <p className="eyebrow text-ink-3 mt-2">Activas</p>
        </article>
        <article className="bg-receipt px-5 py-5">
          <p className="eyebrow text-ink-3">02 · Vencidas</p>
          <p className="numeral text-alizarin tabular mt-3 text-[36px]">
            {String(expiredCount).padStart(2, '0')}
          </p>
          <p className="eyebrow text-ink-3 mt-2">Requieren atención</p>
        </article>
        <article className="bg-receipt px-5 py-5">
          <p className="eyebrow text-ink-3">03 · Enterprise</p>
          <p className="numeral text-naranja tabular mt-3 text-[36px]">
            {String(enterpriseCount).padStart(2, '0')}
          </p>
          <p className="eyebrow text-ink-3 mt-2">Gran escala</p>
        </article>
      </section>

      <div className="fade-up relative max-w-sm" style={{ animationDelay: '120ms' }}>
        <Search
          className="text-ink-3 pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
          strokeWidth={1.5}
        />
        <Input
          placeholder="Buscar empresa o slug…"
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="fade-up" style={{ animationDelay: '180ms' }}>
        <CardEyebrow className="eyebrow flex items-center justify-between">
          <span>Organizaciones</span>
          <Building2 className="text-ink-3 h-3.5 w-3.5" strokeWidth={1.5} />
        </CardEyebrow>
        <CardContent className="pt-5">
          {isLoading ? (
            <div className="border-ink/14 divide-ink/10 divide-y border">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-receipt p-4">
                  <div className="bg-ink/10 h-4 w-40 animate-pulse" />
                </div>
              ))}
            </div>
          ) : filteredOrgs.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Sin organizaciones para mostrar"
              description={
                search
                  ? `Vacío para "${search}". Probá con otro término.`
                  : 'Cuando se registren clientes, aparecerán acá.'
              }
            />
          ) : (
            <div className="border-ink/14 bg-paper-2 overflow-x-auto border">
              <table className="w-full text-sm">
                <thead className="bg-receipt border-ink/14 text-ink-3 border-b">
                  <tr>
                    <th className="eyebrow px-4 py-2.5 text-left">Empresa</th>
                    <th className="eyebrow px-4 py-2.5 text-left">Tamaño</th>
                    <th className="eyebrow px-4 py-2.5 text-left">Estado soporte</th>
                    <th className="eyebrow px-4 py-2.5 text-left">Plan</th>
                    <th className="eyebrow px-4 py-2.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrgs.map((org) => {
                    const s = SUPPORT_STAMPS[org.supportStatus] || {
                      tone: 'mute' as const,
                      stamp: org.supportStatus,
                    };
                    return (
                      <tr
                        key={org.id}
                        className="bg-receipt border-ink/10 hover:bg-paper-2 border-b transition-colors last:border-b-0"
                      >
                        <td className="font-display px-4 py-3 text-[15px]">{org.name}</td>
                        <td className="px-4 py-3">
                          <span className="eyebrow border-ink/22 border px-1.5 py-0.5">
                            {org.companySize === 'SME' ? 'PYME' : 'Enterprise'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Stamp tone={s.tone} size="sm" rotate={-1.5}>
                            {s.stamp}
                          </Stamp>
                        </td>
                        <td className="text-ink-3 px-4 py-3 font-mono text-[11px]">{org.plan}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-[11px]"
                            onClick={() => (window.location.href = `/support/org/${org.id}`)}
                          >
                            Gestionar <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
