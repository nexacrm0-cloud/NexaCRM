'use client';

import { useQuery } from '@tanstack/react-query';
import { Send, ArrowRight, ShieldCheck } from 'lucide-react';

import { api } from '@/lib/api-client';
import { usePermissions } from '@/hooks/use-permissions';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardEyebrow } from '@/components/ui/card';
import { Stamp } from '@/components/ui/stamp';
import { lookupStatus } from '@/components/ui/status-stamps';
import { EmptyState } from '@/components/ui/empty-state';

const STATUS_STAMPS = [
  { key: 'ACCEPTED', tone: 'verde' as const, stamp: 'ACEPTADA' },
  { key: 'PENDING', tone: 'cobalt' as const, stamp: 'PENDIENTE' },
  { key: 'EXPIRED', tone: 'alizarin' as const, stamp: 'EXPIRADA' },
  { key: 'REVOKED', tone: 'mute' as const, stamp: 'REVOCADA' },
];

type Row = {
  invitationId: string;
  email: string;
  organizationId: string;
  organizationName: string;
  organizationPlan: string;
  createdAt: string;
  status: string;
  workflowId: string | null;
  workflowName: string | null;
  workflowTrigger: string | null;
};

export default function TransfersPage() {
  const { canManageSettings } = usePermissions();
  const { data, isLoading } = useQuery({
    queryKey: ['workflowTransfers'],
    queryFn: () => api.get<{ data: Row[] }>('/automation/workflows/transfers/recent'),
    enabled: canManageSettings,
  });

  const rows = data?.data ?? [];

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <PageHeader
        eyebrow="Operación"
        title="Transferencias recientes"
        description="Clientes y workspaces que recibieron tus automatizaciones en los últimos días."
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
      ) : isLoading ? (
        <Card>
          <CardContent className="space-y-3 pt-5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-receipt border-ink/14 h-12 animate-pulse border" />
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card className="fade-up">
          <CardEyebrow className="eyebrow flex items-center justify-between">
            <span>Últimas transferencias</span>
            <span className="eyebrow text-ink-3">{rows.length} en total</span>
          </CardEyebrow>
          <CardContent className="overflow-x-auto pt-5">
            {rows.length === 0 ? (
              <EmptyState
                icon={Send}
                title="Sin transferencias todavía"
                description="Cuando transfieras una automatización a un cliente, vas a ver el historial acá."
              />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-receipt border-ink/14 text-ink-3 border-b">
                  <tr>
                    <th className="eyebrow px-4 py-2.5 text-left">Fecha</th>
                    <th className="eyebrow px-4 py-2.5 text-left">Email destino</th>
                    <th className="eyebrow px-4 py-2.5 text-left">Workspace</th>
                    <th className="eyebrow px-4 py-2.5 text-left">Flujo transferido</th>
                    <th className="eyebrow px-4 py-2.5 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const s = lookupStatus(STATUS_STAMPS, row.status);
                    return (
                      <tr
                        key={row.invitationId}
                        className="bg-receipt border-ink/10 hover:bg-paper-2 border-b transition-colors last:border-b-0"
                      >
                        <td className="eyebrow text-ink-3 px-4 py-3">
                          {new Date(row.createdAt).toLocaleString('es-AR')}
                        </td>
                        <td className="font-display px-4 py-3 text-[15px]">{row.email}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span>{row.organizationName}</span>
                            <span className="text-ink/22">·</span>
                            <Stamp tone="mute" size="sm" rotate={1.5}>
                              {row.organizationPlan.toUpperCase()}
                            </Stamp>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-display text-[14px]">
                              {row.workflowName ?? '—'}
                            </span>
                            {row.workflowTrigger && (
                              <span className="border-ink/22 border px-1.5 py-0.5 font-mono text-[11px]">
                                {row.workflowTrigger}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Stamp tone={s.tone} size="sm" rotate={-1.5}>
                            {s.stamp}
                          </Stamp>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
