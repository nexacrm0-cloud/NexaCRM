'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardEyebrow } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/layout/page-header';
import { Stamp } from '@/components/ui/stamp';
import { lookupStatus } from '@/components/ui/status-stamps';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MessageSquare,
  Mail,
  Calendar,
  CreditCard,
  FileSpreadsheet,
  Link,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Globe,
  Zap,
  ArrowUpCircle,
} from 'lucide-react';
import { usePlan } from '@/hooks/use-plan';
import { useRouter } from 'next/navigation';
import { toast } from '@/hooks/use-toast';

type Connector = {
  id: string;
  name: string;
  displayName: string;
  config: Record<string, any> | null;
  isActive: boolean;
  createdAt: string;
};

const CONNECTOR_FIELDS: Record<string, { label: string; placeholder: string; type: string }> = {
  webhookUrl: {
    label: 'Webhook URL (n8n)',
    placeholder: 'https://tu-n8n.example.com/webhook/...',
    type: 'text',
  },
  apiKey: { label: 'API Key', placeholder: 'sk-...', type: 'password' },
  accessToken: { label: 'Access Token', placeholder: '...', type: 'password' },
  accountId: { label: 'Account ID', placeholder: '...', type: 'text' },
  apiSecret: { label: 'API Secret', placeholder: '...', type: 'password' },
  smtpHost: { label: 'SMTP Host', placeholder: 'smtp.gmail.com', type: 'text' },
  smtpPort: { label: 'SMTP Port', placeholder: '587', type: 'text' },
  smtpUser: { label: 'SMTP User', placeholder: 'usuario@gmail.com', type: 'text' },
  smtpPassword: { label: 'SMTP Password', placeholder: '...', type: 'password' },
  n8nWorkflowUrl: {
    label: 'URL del workflow n8n',
    placeholder: 'https://tu-n8n.example.com/workflow/...',
    type: 'text',
  },
};

const CONNECTOR_META: Record<
  string,
  { label: string; description: string; icon: typeof MessageSquare; fields: string[] }
> = {
  whatsapp: {
    label: 'WhatsApp Business',
    description: 'Enviar y recibir mensajes vía API oficial',
    icon: MessageSquare,
    fields: ['apiKey', 'accessToken', 'webhookUrl'],
  },
  email: {
    label: 'Email (SMTP)',
    description: 'Transaccionales y campañas de marketing',
    icon: Mail,
    fields: ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPassword'],
  },
  google_calendar: {
    label: 'Google Calendar',
    description: 'Sincronizar eventos y citas',
    icon: Calendar,
    fields: ['apiKey', 'webhookUrl'],
  },
  slack: {
    label: 'Slack',
    description: 'Notificaciones a canales de Slack',
    icon: MessageSquare,
    fields: ['webhookUrl', 'n8nWorkflowUrl'],
  },
  teams: {
    label: 'Microsoft Teams',
    description: 'Notificaciones a canales de Teams',
    icon: MessageSquare,
    fields: ['webhookUrl', 'n8nWorkflowUrl'],
  },
  stripe: {
    label: 'Stripe',
    description: 'Pagos y suscripciones con Stripe',
    icon: CreditCard,
    fields: ['apiKey', 'apiSecret'],
  },
  mercado_pago: {
    label: 'Mercado Pago',
    description: 'Pagos para Argentina y LATAM',
    icon: CreditCard,
    fields: ['apiKey', 'accessToken'],
  },
  shopify: {
    label: 'Shopify',
    description: 'Productos, pedidos y clientes',
    icon: Globe,
    fields: ['apiKey', 'apiSecret', 'webhookUrl'],
  },
  woocommerce: {
    label: 'WooCommerce',
    description: 'Tu tienda WooCommerce enganchada',
    icon: Globe,
    fields: ['apiKey', 'apiSecret', 'webhookUrl'],
  },
  google_sheets: {
    label: 'Google Sheets',
    description: 'Importar y exportar a Sheets',
    icon: FileSpreadsheet,
    fields: ['apiKey', 'webhookUrl'],
  },
  webhook: {
    label: 'Webhook custom',
    description: 'POST/GET a cualquier URL',
    icon: Link,
    fields: ['webhookUrl'],
  },
};

const CONNECTOR_INITIALS: Record<string, string> = {
  whatsapp: 'WA',
  email: 'EM',
  google_calendar: 'GC',
  slack: 'SL',
  teams: 'MS',
  stripe: 'ST',
  mercado_pago: 'MP',
  shopify: 'SH',
  woocommerce: 'WC',
  google_sheets: 'GS',
  webhook: 'WB',
};

export default function ConnectorsPage() {
  const { isStarter } = usePlan();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [configuringConnector, setConfiguringConnector] = useState<string | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});

  const { data: connectors, isLoading } = useQuery({
    queryKey: ['connectors'],
    queryFn: () => api.get<Connector[]>('/connectors'),
    enabled: isStarter,
  });

  const upsertMutation = useMutation({
    mutationFn: (data: { type: string; config: Record<string, any> }) =>
      api.patch('/connectors', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connectors'] });
      setConfiguringConnector(null);
      setConfigValues({});
      toast({ title: 'Conector guardado', variant: 'success' });
    },
    onError: (err: Error) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/connectors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connectors'] });
      toast({ title: 'Conector eliminado', variant: 'success' });
    },
    onError: (err: Error) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  if (!isStarter) {
    return (
      <div className="fade-up mx-auto max-w-2xl py-12">
        <EmptyState
          icon={ArrowUpCircle}
          title="Disponible desde el plan Starter"
          description="Los Conectores se desbloquean a partir del plan Starter, con n8n como orquestador."
          action={
            <Button onClick={() => router.push('/pricing')} variant="ink">
              Ver planes
            </Button>
          }
        />
      </div>
    );
  }

  const installedMap = new Map((connectors ?? []).map((c) => [c.name, c]));
  const installedCount = installedMap.size;
  const availableCount = Object.keys(CONNECTOR_META).length - installedCount;

  function handleConfigure(type: string) {
    const existing = installedMap.get(type);
    setConfigValues(
      existing?.config
        ? Object.fromEntries(
            Object.entries(existing.config)
              .filter(([k]) => k !== 'settings')
              .map(([k, v]) => [k, String(v ?? '')]),
          )
        : {},
    );
    setConfiguringConnector(type);
  }

  function handleSave() {
    if (!configuringConnector) return;
    upsertMutation.mutate({
      type: configuringConnector,
      config: { settings: {}, ...configValues },
    });
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <PageHeader
        eyebrow="Integraciones"
        numeral={String(installedCount).padStart(2, '0')}
        title="Conectores"
        description="Lo que ya está enganchado a tu CRM, y lo que todavía no."
      />

      <div className="fade-up flex items-center gap-3" style={{ animationDelay: '60ms' }}>
        <span className="eyebrow text-naranja border-naranja/40 inline-flex items-center gap-2 border px-2 py-1">
          <Zap className="h-3 w-3" strokeWidth={1.7} />
          {String(installedCount).padStart(2, '0')} conectados
        </span>
        <span className="eyebrow text-ink-3 border-ink/22 inline-flex items-center gap-2 border px-2 py-1">
          <Globe className="h-3 w-3" strokeWidth={1.7} />
          {String(availableCount).padStart(2, '0')} disponibles
        </span>
      </div>

      {isLoading ? (
        <div className="border-ink/14 bg-ink/14 grid grid-cols-1 gap-px border md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-receipt animate-pulse space-y-3 p-5">
              <div className="bg-ink/10 h-10 w-10" />
              <div className="bg-ink/10 h-4 w-32" />
              <div className="bg-ink/10 h-3 w-24" />
            </div>
          ))}
        </div>
      ) : (
        <div className="border-ink/14 bg-ink/14 grid grid-cols-1 gap-px border md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(CONNECTOR_META).map(([type, meta]) => {
            const installed = installedMap.get(type);
            const Icon = meta.icon;
            const initials = CONNECTOR_INITIALS[type] ?? '··';
            const statusStamp = installed
              ? lookupStatus([{ key: 'OK', tone: 'verde', stamp: 'CONECTADO' }], 'OK')
              : lookupStatus([{ key: 'IDLE', tone: 'mute', stamp: 'NO CONECTADO' }], 'IDLE');
            return (
              <article key={type} className="bg-receipt fade-up relative p-5">
                <CardEyebrow className="eyebrow flex items-center justify-between">
                  <span>{type.replace(/_/g, ' ')}</span>
                  <Stamp tone={statusStamp.tone} size="sm" rotate={-1.5}>
                    {statusStamp.stamp}
                  </Stamp>
                </CardEyebrow>

                <div className="mt-4 flex items-start gap-3">
                  <span className="numeral bg-ink text-paper inline-flex h-10 w-10 shrink-0 items-center justify-center text-[12px]">
                    <Icon className="h-4 w-4" strokeWidth={1.7} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-[18px] leading-tight">{meta.label}</h3>
                    <p className="eyebrow text-ink-3 mt-1 line-clamp-2">{meta.description}</p>
                  </div>
                </div>

                <CardContent className="border-ink/14 mt-5 border-t px-0 pt-5">
                  <div className="flex gap-2">
                    {installed ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-[11px]"
                          onClick={() => handleConfigure(type)}
                        >
                          Configurar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-ink-3 hover:text-alizarin"
                          onClick={() => installed && deleteMutation.mutate(installed.id)}
                          aria-label="Desconectar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ink"
                        size="sm"
                        className="flex-1 text-[11px]"
                        onClick={() => handleConfigure(type)}
                      >
                        Conectar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={!!configuringConnector} onOpenChange={() => setConfiguringConnector(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              {configuringConnector && CONNECTOR_META[configuringConnector]
                ? `Configurar ${CONNECTOR_META[configuringConnector].label}`
                : 'Configurar conector'}
            </DialogTitle>
            <DialogDescription>
              Ingresá las credenciales. Se guardan de forma segura y cifrada.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            {configuringConnector &&
              CONNECTOR_META[configuringConnector]?.fields.map((fieldKey) => {
                const field = CONNECTOR_FIELDS[fieldKey] ?? {
                  label: fieldKey,
                  placeholder: '',
                  type: 'text',
                };
                return (
                  <div key={fieldKey} className="flex flex-col gap-1.5">
                    <Label htmlFor={fieldKey} className="eyebrow">
                      {field.label}
                    </Label>
                    <Input
                      id={fieldKey}
                      type={field.type}
                      placeholder={field.placeholder}
                      className="font-mono text-xs"
                      value={configValues[fieldKey] ?? ''}
                      onChange={(e) =>
                        setConfigValues((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                      }
                    />
                  </div>
                );
              })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfiguringConnector(null)}>
              Cancelar
            </Button>
            <Button variant="ink" onClick={handleSave} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
