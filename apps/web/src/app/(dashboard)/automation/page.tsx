'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardEyebrow } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stamp } from '@/components/ui/stamp';
import { lookupStatus } from '@/components/ui/status-stamps';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Zap,
  Play,
  Pause,
  Trash2,
  ExternalLink,
  Search,
  Activity,
  ShieldCheck,
  ArrowUpCircle,
  Loader2,
  Send,
} from 'lucide-react';
import { Workflow } from '@nexa/shared';
import { usePlan } from '@/hooks/use-plan';
import { usePermissions } from '@/hooks/use-permissions';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/use-toast';

const TRIGGER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'client.created', label: 'Cliente creado' },
  { value: 'client.updated', label: 'Cliente actualizado' },
  { value: 'deal.created', label: 'Oportunidad creada' },
  { value: 'deal.moved', label: 'Oportunidad movida de etapa' },
  { value: 'task.created', label: 'Tarea creada' },
  { value: 'task.completed', label: 'Tarea completada' },
  { value: 'quote.sent', label: 'Presupuesto enviado' },
  { value: 'quote.accepted', label: 'Presupuesto aceptado' },
  { value: 'quote.rejected', label: 'Presupuesto rechazado' },
  { value: 'invoice.issued', label: 'Factura emitida' },
  { value: 'invoice.paid', label: 'Factura pagada' },
];

export default function AutomationPage() {
  const { isStarter } = usePlan();
  const { canManageSettings } = usePermissions();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    trigger: 'client.created',
    webhookUrl: '',
    n8nUrl: '',
  });
  const [transferTarget, setTransferTarget] = useState<Workflow | null>(null);
  const queryClient = useQueryClient();

  const { data: workflows, isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => api.get<Workflow[]>('/automation/workflows'),
    enabled: isStarter,
  });

  const toggleStatus = useMutation({
    mutationFn: (id: string) => api.patch(`/automation/workflows/${id}/toggle`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
    onError: (err: Error) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/automation/workflows/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
    onError: (err: Error) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post<Workflow>('/automation/workflows', {
        name: form.name.trim(),
        trigger: form.trigger,
        triggerConfig: {
          webhookUrl: form.webhookUrl.trim(),
          ...(form.n8nUrl.trim() ? { n8n_workflow_url: form.n8nUrl.trim() } : {}),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      toast({ title: 'Automatización creada' });
      setCreateOpen(false);
      setForm({ name: '', trigger: 'client.created', webhookUrl: '', n8nUrl: '' });
    },
    onError: (err: Error) =>
      toast({ title: 'Error al crear', description: err.message, variant: 'destructive' }),
  });

  const transferMutation = useMutation({
    mutationFn: ({ id, targetEmail }: { id: string; targetEmail: string }) =>
      api.post<{
        workflowId: string;
        targetOrganizationId: string;
        invitationId: string | null;
        organizationCreated: boolean;
      }>(`/automation/workflows/${encodeURIComponent(id)}/transfer`, { targetEmail }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      setTransferTarget(null);
      const orgLine = res.organizationCreated
        ? 'Creamos un workspace nuevo y le mandamos la invitación.'
        : 'El cliente ya tenía workspace; sumamos el flujo ahí.';
      toast({
        title: 'Automatización transferida',
        description: `${orgLine} Sin invitación previa creada: ${res.invitationId ? 'sí' : 'no'}.`,
      });
    },
    onError: (err: Error) =>
      toast({
        title: 'No pudimos transferir',
        description: err.message,
        variant: 'destructive',
      }),
  });

  const filteredWorkflows =
    workflows?.filter(
      (w) =>
        w.name.toLowerCase().includes(search.toLowerCase()) ||
        w.trigger.toLowerCase().includes(search.toLowerCase()),
    ) || [];

  if (!isStarter) {
    return (
      <div className="fade-up mx-auto max-w-2xl py-12">
        <EmptyState
          icon={ArrowUpCircle}
          title="Disponible desde el plan Starter"
          description="El Centro de Automatización se desbloquea a partir del plan Starter, con conexión a n8n para flujos entre tus apps."
          action={
            <Button onClick={() => router.push('/pricing')} variant="ink">
              Ver planes
            </Button>
          }
        />
      </div>
    );
  }

  const activeCount = workflows?.filter((w) => w.isActive).length ?? 0;
  const totalCount = workflows?.length ?? 0;

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <PageHeader
        eyebrow="Automatización"
        numeral={String(totalCount).padStart(2, '0')}
        title="Centro de automatización"
        description="Conecta Nexa con n8n. Cuando pase algo en tu CRM, pasa en otro lado."
        actions={
          <Button variant="ink" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            Crear flujo
          </Button>
        }
      />

      <section
        className="border-ink/14 bg-ink/14 fade-up grid gap-px border md:grid-cols-3"
        style={{ animationDelay: '60ms' }}
      >
        <article className="bg-receipt px-5 py-5">
          <p className="eyebrow text-ink-3">01 · Flujos activos</p>
          <p className="numeral text-naranja tabular mt-3 text-[36px]">
            {String(activeCount).padStart(2, '0')}
          </p>
          <p className="eyebrow text-ink-3 mt-2">Corriendo ahora</p>
        </article>
        <article className="bg-receipt px-5 py-5">
          <p className="eyebrow text-ink-3">02 · Total configurados</p>
          <p className="numeral tabular mt-3 text-[36px]">{String(totalCount).padStart(2, '0')}</p>
          <p className="eyebrow text-ink-3 mt-2">En total</p>
        </article>
        <article className="bg-receipt px-5 py-5">
          <p className="eyebrow text-ink-3">03 · Sincronización n8n</p>
          <p className="numeral text-verde mt-3 flex items-baseline gap-2 text-[28px]">
            <ShieldCheck className="text-verde h-5 w-5" strokeWidth={1.7} />
            Conectado
          </p>
          <p className="eyebrow text-ink-3 mt-2">Webhooks activos</p>
        </article>
      </section>

      <div className="fade-up relative max-w-sm" style={{ animationDelay: '120ms' }}>
        <Search
          className="text-ink-3 pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
          strokeWidth={1.5}
        />
        <Input
          placeholder="Buscar por nombre o evento…"
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="fade-up" style={{ animationDelay: '180ms' }}>
        <CardEyebrow className="eyebrow flex items-center justify-between">
          <span>Tus automatizaciones</span>
          <Activity className="text-ink-3 h-3.5 w-3.5" strokeWidth={1.5} />
        </CardEyebrow>
        <CardContent className="pt-5">
          {isLoading ? (
            <div className="border-ink/14 divide-ink/10 divide-y border">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-receipt space-y-2 p-4">
                  <div className="bg-ink/10 h-4 w-40 animate-pulse" />
                  <div className="bg-ink/10 h-3 w-24 animate-pulse" />
                </div>
              ))}
            </div>
          ) : filteredWorkflows.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="Sin automatizaciones todavía"
              description="Cuando conectes Nexa con n8n, vas a ver acá los flujos activos. Empezá por uno simple."
            />
          ) : (
            <div className="border-ink/14 bg-paper-2 overflow-x-auto border">
              <table className="w-full text-sm">
                <thead className="bg-receipt border-ink/14 text-ink-3 border-b">
                  <tr>
                    <th className="eyebrow px-4 py-2.5 text-left">Nombre</th>
                    <th className="eyebrow px-4 py-2.5 text-left">Disparador</th>
                    <th className="eyebrow px-4 py-2.5 text-left">Estado</th>
                    <th className="eyebrow px-4 py-2.5 text-left">Acción</th>
                    <th className="eyebrow px-4 py-2.5 text-right">Controles</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkflows.map((workflow) => {
                    const statusKey = workflow.isActive ? 'AUTOMATION_ON' : 'AUTOMATION_OFF';
                    const s = lookupStatus(
                      [
                        { key: 'AUTOMATION_ON', tone: 'verde' as const, stamp: 'ACTIVO' },
                        { key: 'AUTOMATION_OFF', tone: 'mute' as const, stamp: 'PAUSADO' },
                      ],
                      statusKey,
                    );
                    return (
                      <tr
                        key={workflow.id}
                        className="bg-receipt border-ink/10 hover:bg-paper-2 border-b transition-colors last:border-b-0"
                      >
                        <td className="font-display px-4 py-3 text-[15px]">{workflow.name}</td>
                        <td className="px-4 py-3">
                          <span className="border-ink/22 border px-1.5 py-0.5 font-mono text-[11px]">
                            {workflow.trigger}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Stamp tone={s.tone} size="sm" rotate={workflow.isActive ? 1 : -1}>
                            {s.stamp}
                          </Stamp>
                        </td>
                        <td className="px-4 py-3">
                          <div className="eyebrow text-ink-3 inline-flex items-center gap-1.5">
                            <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
                            n8n Webhook
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-[11px]"
                              onClick={() => {
                                const url = (workflow.triggerConfig as any)?.n8n_workflow_url;
                                if (url) window.open(url, '_blank');
                                else
                                  toast({
                                    title: 'URL de n8n no configurada',
                                    variant: 'destructive',
                                  });
                              }}
                            >
                              <ExternalLink className="mr-1 h-3 w-3" /> Editar
                            </Button>
                            {canManageSettings && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-[11px]"
                                onClick={() => setTransferTarget(workflow)}
                                aria-label="Transferir a un cliente"
                              >
                                <Send className="mr-1 h-3.5 w-3.5" /> Transferir
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[11px]"
                              onClick={() => toggleStatus.mutate(workflow.id)}
                              aria-label={workflow.isActive ? 'Pausar' : 'Activar'}
                            >
                              {workflow.isActive ? (
                                <Pause className="h-3.5 w-3.5" />
                              ) : (
                                <Play className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-ink-3 hover:text-alizarin text-[11px]"
                              onClick={() => deleteMutation.mutate(workflow.id)}
                              aria-label="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Nueva automatización</DialogTitle>
            <DialogDescription>
              Conectá Nexa con n8n. Cuando ocurra el evento, Nexa va a llamar al webhook que indique
              el flujo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="eyebrow text-ink-3">Nombre</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Notificar Slack cuando llega un lead"
                maxLength={255}
              />
            </div>

            <div className="space-y-1.5">
              <label className="eyebrow text-ink-3">Disparador</label>
              <select
                className="border-ink/22 bg-paper-1 focus:border-ink h-10 w-full border px-3 font-mono text-sm focus:outline-none"
                value={form.trigger}
                onChange={(e) => setForm({ ...form, trigger: e.target.value })}
              >
                {TRIGGER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label} · {o.value}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="eyebrow text-ink-3">
                Webhook URL de n8n <span className="text-alizarin">*</span>
              </label>
              <Input
                value={form.webhookUrl}
                onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
                placeholder="https://n8n.example.com/webhook/..."
              />
              <p className="text-ink-3 mt-1 text-[11px]">
                URL a la que Nexa hará POST cuando se dispare el evento.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="eyebrow text-ink-3">URL del workflow en n8n (opcional)</label>
              <Input
                value={form.n8nUrl}
                onChange={(e) => setForm({ ...form, n8nUrl: e.target.value })}
                placeholder="https://n8n.example.com/workflow/abc"
              />
              <p className="text-ink-3 mt-1 text-[11px]">
                Se usa para el botón <em>Editar</em> en la tarjeta del flujo.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="ink"
              size="sm"
              disabled={createMutation.isPending || !form.name.trim() || !form.webhookUrl.trim()}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="mr-2 h-3.5 w-3.5" />
              )}
              Crear flujo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!transferTarget} onOpenChange={(o) => !o && setTransferTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Transferir a un cliente</DialogTitle>
            <DialogDescription>
              Si el email ya existe, copiamos el flujo a su workspace. Si no, creamos un workspace
              nuevo en plan Pro y le mandamos una invitación para aceptarla.
            </DialogDescription>
          </DialogHeader>

          {transferTarget && (
            <TransferForm
              workflow={transferTarget}
              isPending={transferMutation.isPending}
              onSubmit={(targetEmail) =>
                transferMutation.mutate({ id: transferTarget.id, targetEmail })
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TransferForm({
  workflow,
  isPending,
  onSubmit,
}: {
  workflow: Workflow;
  isPending: boolean;
  onSubmit: (targetEmail: string) => void;
}) {
  const [email, setEmail] = useState('');
  const valid = /\S+@\S+\.\S+/.test(email);
  return (
    <div className="space-y-4">
      <div className="bg-receipt border-ink/14 flex items-center justify-between border p-3">
        <div>
          <p className="eyebrow text-ink-3">Vas a transferir</p>
          <p className="font-display mt-0.5 text-[16px] leading-tight">{workflow.name}</p>
        </div>
        <span className="border-ink/22 border px-1.5 py-0.5 font-mono text-[11px]">
          {workflow.trigger}
        </span>
      </div>

      <div className="space-y-1.5">
        <label className="eyebrow text-ink-3">
          Email del cliente <span className="text-alizarin">*</span>
        </label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="cliente@empresa.com"
        />
        <p className="text-ink-3 mt-1 text-[11px]">
          Si tiene cuenta activa, el flujo va a parar al workspace existente. Si no, le creamos uno
          nuevo.
        </p>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="ghost" size="sm" disabled={isPending}>
          Cancelar
        </Button>
        <Button
          variant="ink"
          size="sm"
          disabled={!valid || isPending}
          onClick={() => onSubmit(email.trim())}
        >
          {isPending ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="mr-2 h-3.5 w-3.5" />
          )}
          Transferir
        </Button>
      </DialogFooter>
    </div>
  );
}
