'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardEyebrow, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Stamp } from '@/components/ui/stamp';
import { lookupStatus } from '@/components/ui/status-stamps';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Bot,
  Target,
  Clock,
  BarChart3,
  Settings,
  MessageSquare,
  KeyRound,
  Lock,
  CheckCircle2,
  Zap,
  TrendingUp,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Activity,
  XCircle,
  Copy,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';

type Agent = {
  id: string;
  name: string;
  displayName: string;
  description: string;
  type: string;
  icon: string | null;
  webhookUrl: string;
  workflowUrl: string | null;
  requiredPlan: string;
  features: string[];
  isActive: boolean;
  isSubscribed: boolean;
  isUnlocked: boolean;
  apiKey?: string;
};

type AgentMetrics = {
  agentId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  lastExecutionAt: string | null;
};

type AgentLog = {
  id: string;
  status: string;
  input: Record<string, any>;
  output: Record<string, any> | null;
  error: string | null;
  durationMs: number | null;
  startedAt: string;
  completedAt: string | null;
};

const AGENT_ICONS: Record<string, typeof Bot> = {
  sales: Target,
  follow_up: Clock,
  business_analyst: BarChart3,
  operations: Settings,
  whatsapp_ai: MessageSquare,
};

function ApiKeyDialog({
  agent,
  trigger,
  autoOpen = false,
}: {
  agent: Agent;
  trigger?: React.ReactNode;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const { data: keyData, isLoading } = useQuery<{ apiKey: string }>({
    queryKey: ['agent-apikey', agent.id],
    queryFn: () => api.get<{ apiKey: string }>(`/agents/${agent.id}/api-key`),
    enabled: open && !!agent.apiKey,
  });

  const regenerateMutation = useMutation({
    mutationFn: () => api.post<{ apiKey: string }>(`/agents/${agent.id}/api-key/regenerate`),
    onSuccess: (data) => {
      setRevealed(data.apiKey);
      queryClient.invalidateQueries({ queryKey: ['agent-apikey', agent.id] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  React.useEffect(() => {
    if (open) {
      setRevealed(keyData?.apiKey ?? agent.apiKey ?? null);
      setCopied(false);
    }
  }, [open, keyData, agent.apiKey]);

  const handleCopy = async () => {
    if (revealed) {
      await navigator.clipboard.writeText(revealed);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <KeyRound className="mr-1 h-3 w-3" />
            Ver API Key
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            API Key — {agent.displayName}
          </DialogTitle>
          <DialogDescription>
            Esta key la usa el workflow de n8n para escribir en tu CRM en nombre de este agente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border-naranja/40 bg-naranja/10 flex items-start gap-3 border px-3 py-2 text-sm">
            <AlertTriangle className="text-naranja mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.7} />
            <div className="text-ink-2">
              <strong className="text-ink">Solo se muestra una vez.</strong> Cópiala ahora y
              guardala en un lugar seguro (password manager). Si la perdés, podés regenerarla — la
              versión anterior quedará <strong>revocada</strong>.
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key" className="eyebrow">
              API Key
            </Label>
            <div className="flex gap-2">
              <Input
                id="api-key"
                readOnly
                value={isLoading ? 'cargando…' : (revealed ?? '(no disponible)')}
                className="font-mono text-xs"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={!revealed}
                className="shrink-0 text-[11px]"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-3 w-3" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="text-ink-3 bg-paper-2 border-ink/14 space-y-1 border px-3 py-2 text-xs">
            <div className="eyebrow text-ink">Cómo usarla:</div>
            <p>
              Configura n8n para enviar el header{' '}
              <code className="bg-receipt border-ink/14 border px-1 font-mono">
                x-agent-api-key: {revealed ? revealed.slice(0, 10) + '…' : '—'}
              </code>{' '}
              en cada request.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => regenerateMutation.mutate()}
            disabled={regenerateMutation.isPending}
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            {regenerateMutation.isPending ? 'Regenerando…' : 'Regenerar Key'}
          </Button>
          <Button variant="ink" onClick={() => setOpen(false)}>
            Listo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AgentMetricsCard({ agent }: { agent: Agent }) {
  const [showLogs, setShowLogs] = useState(false);

  const { data: metrics } = useQuery<AgentMetrics>({
    queryKey: ['agent-metrics', agent.id],
    queryFn: () => api.get<AgentMetrics>(`/agents/${agent.id}/metrics`),
    enabled: agent.isSubscribed,
  });

  const { data: logs, isLoading: logsLoading } = useQuery<AgentLog[]>({
    queryKey: ['agent-logs', agent.id],
    queryFn: () => api.get<AgentLog[]>(`/agents/${agent.id}/logs`),
    enabled: agent.isSubscribed && showLogs,
  });

  if (!agent.isSubscribed || !metrics) return null;

  const stamp =
    metrics.failedExecutions === 0 && metrics.totalExecutions > 0
      ? lookupStatus([{ key: 'OK', tone: 'verde', stamp: 'OK' }], 'OK')
      : metrics.failedExecutions > 0
        ? lookupStatus([{ key: 'WARN', tone: 'alizarin', stamp: 'CON FALLOS' }], 'WARN')
        : lookupStatus([{ key: 'IDLE', tone: 'mute', stamp: 'EN REPOSO' }], 'IDLE');

  return (
    <div className="border-ink/14 mt-5 space-y-3 border-t pt-4">
      <div className="flex items-center justify-between">
        <span className="eyebrow text-ink-3">Estado del agente</span>
        <Stamp tone={stamp.tone} size="sm" rotate={-1.2}>
          {stamp.stamp}
        </Stamp>
      </div>
      <div className="border-ink/14 bg-ink/14 grid grid-cols-3 gap-px border">
        <div className="bg-receipt px-3 py-3 text-center">
          <p className="numeral text-naranja tabular text-[22px]">{metrics.totalExecutions}</p>
          <p className="eyebrow text-ink-3 mt-1">Ejecuciones</p>
        </div>
        <div className="bg-receipt px-3 py-3 text-center">
          <p className="numeral text-verde tabular text-[22px]">{metrics.successfulExecutions}</p>
          <p className="eyebrow text-ink-3 mt-1">Exitosas</p>
        </div>
        <div className="bg-receipt px-3 py-3 text-center">
          <p className="numeral text-alizarin tabular text-[22px]">{metrics.failedExecutions}</p>
          <p className="eyebrow text-ink-3 mt-1">Fallidas</p>
        </div>
      </div>
      <div className="text-ink-3 flex items-baseline justify-between font-mono text-xs">
        <span>
          Tasa de éxito ·{' '}
          <span className="numeral text-ink">{metrics.successRate.toFixed(1)}%</span>
        </span>
        {metrics.lastExecutionAt && (
          <span>Última · {new Date(metrics.lastExecutionAt).toLocaleString('es-AR')}</span>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-[11px] uppercase tracking-[0.16em]"
        onClick={() => setShowLogs(!showLogs)}
      >
        <Activity className="mr-1 h-3 w-3" />
        {showLogs ? 'Ocultar' : 'Ver'} logs
        {showLogs ? (
          <ChevronUp className="ml-1 h-3 w-3" />
        ) : (
          <ChevronDown className="ml-1 h-3 w-3" />
        )}
      </Button>
      {showLogs && (
        <div className="border-ink/14 bg-ink/14 max-h-48 space-y-px overflow-y-auto border">
          {logsLoading ? (
            <p className="eyebrow text-ink-3 bg-receipt py-3 text-center">Cargando…</p>
          ) : logs && logs.length > 0 ? (
            logs.map((log) => {
              const tone =
                log.status === 'COMPLETED'
                  ? 'verde'
                  : log.status === 'FAILED'
                    ? 'alizarin'
                    : 'cobalt';
              const Icon =
                log.status === 'COMPLETED'
                  ? CheckCircle2
                  : log.status === 'FAILED'
                    ? XCircle
                    : Activity;
              return (
                <div key={log.id} className="bg-receipt flex items-start gap-2 px-3 py-2 text-xs">
                  <Icon
                    className={`mt-0.5 h-3 w-3 text-${tone === 'verde' ? 'verde' : tone === 'alizarin' ? 'alizarin' : 'cobalt'} shrink-0`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <span
                        className={`eyebrow text-${tone === 'verde' ? 'verde' : tone === 'alizarin' ? 'alizarin' : 'cobalt'}`}
                      >
                        {log.status}
                      </span>
                      <span className="eyebrow text-ink-3 font-mono">
                        {new Date(log.startedAt).toLocaleString('es-AR')}
                      </span>
                    </div>
                    {log.output && (
                      <div className="text-ink-3 mt-1 truncate">
                        {log.output.message || JSON.stringify(log.output).substring(0, 80)}
                      </div>
                    )}
                    {log.error && <div className="text-alizarin mt-1 truncate">{log.error}</div>}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="eyebrow text-ink-3 bg-receipt py-3 text-center">Sin ejecuciones aún</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AgentsPage() {
  const queryClient = useQueryClient();
  const [activeAgentForKey, setActiveAgentForKey] = useState<Agent | null>(null);

  const { data: agents, isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.get<Agent[]>('/agents'),
  });

  const activateMutation = useMutation({
    mutationFn: (agentId: string) => api.post(`/agents/${agentId}/activate`),
    onSuccess: async (_data, agentId) => {
      await queryClient.invalidateQueries({ queryKey: ['agents'] });
      const updated = await queryClient.fetchQuery<Agent[]>({
        queryKey: ['agents'],
        queryFn: () => api.get<Agent[]>('/agents'),
      });
      const subscriber = updated.find((a) => a.id === agentId);
      if (subscriber) setActiveAgentForKey(subscriber);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (agentId: string) => api.delete(`/agents/${agentId}/deactivate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  });

  const activeCount = agents?.filter((a) => a.isSubscribed).length ?? 0;
  const totalAgents = agents?.length ?? 0;

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      {activeAgentForKey && (
        <ApiKeyDialog key={activeAgentForKey.id} agent={activeAgentForKey} autoOpen />
      )}

      <PageHeader
        eyebrow="AI"
        numeral={String(totalAgents).padStart(2, '0')}
        title="AI Agents"
        description="Agentes que corren tareas por vos, 24/7. Activá los que ya pagás."
      />

      <section
        className="border-ink/14 bg-ink/14 fade-up grid gap-px border md:grid-cols-3"
        style={{ animationDelay: '60ms' }}
      >
        <article className="bg-receipt px-5 py-5">
          <p className="eyebrow text-ink-3">01 · Agentes activos</p>
          <p className="numeral text-naranja tabular mt-3 text-[36px]">
            {String(activeCount).padStart(2, '0')}
          </p>
          <p className="eyebrow text-ink-3 mt-2">Trabajando ahora</p>
        </article>
        <article className="bg-receipt px-5 py-5">
          <p className="eyebrow text-ink-3">02 · Disponibles</p>
          <p className="numeral tabular mt-3 text-[36px]">{String(totalAgents).padStart(2, '0')}</p>
          <p className="eyebrow text-ink-3 mt-2">En catálogo</p>
        </article>
        <article className="bg-receipt px-5 py-5">
          <p className="eyebrow text-ink-3">03 · Ahorro estimado</p>
          <p className="numeral text-verde tabular mt-3 text-[36px]">{activeCount * 12}h</p>
          <p className="eyebrow text-ink-3 mt-2">Por mes</p>
        </article>
      </section>

      {isLoading ? (
        <div className="border-ink/14 bg-ink/14 grid grid-cols-1 gap-px border md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-receipt animate-pulse space-y-3 p-6">
              <div className="bg-ink/10 h-12 w-12" />
              <div className="bg-ink/10 h-5 w-40" />
              <div className="bg-ink/10 h-3 w-24" />
            </div>
          ))}
        </div>
      ) : !agents?.length ? (
        <EmptyState
          icon={Bot}
          title="Sin agentes disponibles"
          description="No hay agentes configurados para tu plan todavía."
        />
      ) : (
        <div className="border-ink/14 bg-ink/14 grid grid-cols-1 gap-px border md:grid-cols-2">
          {agents.map((agent) => {
            const Icon = AGENT_ICONS[agent.type] || Bot;
            return (
              <article key={agent.id} className="bg-receipt fade-up relative p-5">
                <CardEyebrow className="eyebrow flex items-center justify-between">
                  <span>{agent.type.replace(/_/g, ' ')}</span>
                  <span className="text-ink-3 font-mono">{agent.requiredPlan}</span>
                </CardEyebrow>

                <div className="mt-4 flex items-start gap-3">
                  <span className="numeral bg-ink text-paper inline-flex h-12 w-12 shrink-0 items-center justify-center text-[16px]">
                    <Icon className="h-5 w-5" strokeWidth={1.7} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-[22px] leading-tight">{agent.displayName}</h3>
                    <p className="eyebrow text-ink-3 mt-1 truncate">
                      {agent.type === 'sales' && 'Agente de ventas'}
                      {agent.type === 'follow_up' && 'Agente de seguimiento'}
                      {agent.type === 'business_analyst' && 'Analista de negocios'}
                      {agent.type === 'operations' && 'Agente de operaciones'}
                    </p>
                  </div>
                  {agent.isSubscribed ? (
                    <Stamp tone="verde" size="sm" rotate={1.5}>
                      ACTIVO
                    </Stamp>
                  ) : !agent.isUnlocked ? (
                    <Stamp tone="mute" size="sm" rotate={-1.5}>
                      <Lock className="mr-1 inline-block h-2.5 w-2.5" />
                      PLAN {agent.requiredPlan}
                    </Stamp>
                  ) : (
                    <Stamp tone="cobalt" size="sm" rotate={-1.5}>
                      DISPONIBLE
                    </Stamp>
                  )}
                </div>

                <p className="text-ink-2 mt-4 text-sm">{agent.description}</p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {agent.features.map((feature, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">
                      {feature}
                    </Badge>
                  ))}
                </div>

                <AgentMetricsCard agent={agent} />

                <CardFooter className="border-ink/14 mt-5 flex flex-wrap gap-2 border-t px-0 pt-5">
                  {agent.isSubscribed ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[11px]"
                      onClick={() => deactivateMutation.mutate(agent.id)}
                    >
                      Desactivar
                    </Button>
                  ) : agent.isUnlocked ? (
                    <Button
                      variant="ink"
                      size="sm"
                      className="text-[11px]"
                      onClick={() => activateMutation.mutate(agent.id)}
                    >
                      Activar agente <ArrowRight className="ml-2 h-3 w-3" />
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="text-[11px]" disabled>
                      <Lock className="mr-2 h-3 w-3" /> Plan {agent.requiredPlan}
                    </Button>
                  )}
                  {agent.isSubscribed && <ApiKeyDialog agent={agent} />}
                  {agent.isSubscribed && agent.workflowUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[11px]"
                      onClick={() => window.open(agent.workflowUrl!, '_blank')}
                    >
                      Ver en n8n
                    </Button>
                  )}
                </CardFooter>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
