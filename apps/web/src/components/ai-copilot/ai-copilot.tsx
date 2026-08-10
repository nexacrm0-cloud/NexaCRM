'use client';

import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, X, Send, Loader2, Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  data?: unknown;
};

function renderData(data: unknown) {
  if (!data) return null;
  const d = data as Record<string, unknown>;

  if (d.actions && Array.isArray(d.actions)) {
    return (
      <div className="mt-2 space-y-1.5">
        {(d.actions as Array<{ priority: string; action: string; impact: string }>).map((a, i) => (
          <div key={i} className="border-border bg-card rounded border p-1.5 text-[11px]">
            <span
              className={`inline-block rounded px-1 py-0.5 text-[10px] font-medium ${
                a.priority === 'ALTA'
                  ? 'bg-red-100 text-red-700'
                  : a.priority === 'MEDIA'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-blue-100 text-blue-700'
              }`}
            >
              {a.priority}
            </span>
            <p className="text-foreground mt-0.5">{a.action}</p>
            <p className="text-muted-foreground">{a.impact}</p>
          </div>
        ))}
      </div>
    );
  }

  if (d.sales || d.pipeline) {
    const insights = d as Record<string, any>;
    return (
      <div className="mt-2 space-y-1 text-[11px]">
        {insights.sales ? (
          <div className="border-border bg-card flex justify-between rounded border p-1.5">
            <span>Ventas del mes</span>
            <span className="font-medium">
              ${Number(insights.sales.monthly || 0).toLocaleString()}
            </span>
          </div>
        ) : null}
        {insights.pipeline ? (
          <div className="border-border bg-card flex justify-between rounded border p-1.5">
            <span>Pipeline</span>
            <span className="font-medium">
              ${Number(insights.pipeline.totalValue || 0).toLocaleString()} (
              {insights.pipeline.totalDeals || 0})
            </span>
          </div>
        ) : null}
        {insights.clients ? (
          <div className="border-border bg-card flex justify-between rounded border p-1.5">
            <span>Clientes nuevos</span>
            <span className="font-medium">{insights.clients.newThisMonth || 0}</span>
          </div>
        ) : null}
        {insights.tasks ? (
          <div className="border-border bg-card flex justify-between rounded border p-1.5">
            <span>{insights.tasks.overdue > 0 ? '⚠ Tareas vencidas' : 'Tareas pendientes'}</span>
            <span
              className={`font-medium ${Number(insights.tasks.overdue || 0) > 0 ? 'text-red-600' : ''}`}
            >
              {insights.tasks.overdue || 0} / {insights.tasks.pending || 0}
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  if (Array.isArray(d)) {
    return (
      <div className="text-muted-foreground mt-2 max-h-24 overflow-auto text-[10px]">
        {d.length > 0 ? (
          <ul className="space-y-0.5">
            {(d as Array<Record<string, unknown>>).slice(0, 10).map((item, i) => (
              <li key={i} className="truncate">
                {String(item.companyName ?? item.title ?? item.description ?? '').slice(0, 80) ||
                  JSON.stringify(item).slice(0, 80)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="italic">Sin resultados</p>
        )}
      </div>
    );
  }

  // Executive summary rendering
  if (d.healthScore !== undefined && d.kpis) {
    const summary = d as Record<string, any>;
    const healthColor =
      summary.healthScore >= 70
        ? 'text-green-600'
        : summary.healthScore >= 40
          ? 'text-yellow-600'
          : 'text-red-600';
    const healthBg =
      summary.healthScore >= 70
        ? 'bg-green-100'
        : summary.healthScore >= 40
          ? 'bg-yellow-100'
          : 'bg-red-100';

    return (
      <div className="mt-2 space-y-2 text-[11px]">
        <div className={`border-border rounded border ${healthBg} p-2`}>
          <div className="flex items-center justify-between">
            <span className="font-medium">Salud del negocio</span>
            <span className={`font-bold ${healthColor}`}>
              {summary.healthLabel} ({summary.healthScore}/100)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="border-border bg-card rounded border p-1.5">
            <span className="text-muted-foreground">Ingresos mes</span>
            <p className="font-medium">
              ${Number(summary.kpis?.monthlyRevenue || 0).toLocaleString()}
            </p>
          </div>
          <div className="border-border bg-card rounded border p-1.5">
            <span className="text-muted-foreground">Pipeline ponderado</span>
            <p className="font-medium">
              ${Number(summary.kpis?.weightedPipeline || 0).toLocaleString()}
            </p>
          </div>
          <div className="border-border bg-card rounded border p-1.5">
            <span className="text-muted-foreground">Oportunidades abiertas</span>
            <p className="font-medium">{summary.kpis?.openDeals || 0}</p>
          </div>
          <div className="border-border bg-card rounded border p-1.5">
            <span className="text-muted-foreground">Clientes totales</span>
            <p className="font-medium">{summary.kpis?.totalClients || 0}</p>
          </div>
        </div>

        {summary.alerts && summary.alerts.total > 0 && (
          <div className="rounded border border-red-200 bg-red-50 p-2">
            <p className="mb-1 font-medium text-red-700">
              ⚠️ {summary.alerts.total} alertas activas
            </p>
            <div className="flex flex-wrap gap-2 text-[10px] text-red-600">
              {summary.alerts.overdueTasks && (
                <span>{summary.alerts.overdueTasks} tareas vencidas</span>
              )}
              {summary.alerts.staleDeals && <span>{summary.alerts.staleDeals} estancadas</span>}
              {summary.alerts.unansweredQuotes && (
                <span>{summary.alerts.unansweredQuotes} sin respuesta</span>
              )}
              {summary.alerts.inactiveClients && (
                <span>{summary.alerts.inactiveClients} inactivos</span>
              )}
            </div>
          </div>
        )}

        {summary.clientHealth && (
          <div className="border-border bg-card rounded border p-2">
            <p className="mb-1 font-medium">Salud de clientes</p>
            <div className="flex gap-2 text-[10px]">
              <span className="text-green-600">✅ {summary.clientHealth.healthy} saludables</span>
              {summary.clientHealth.atRisk > 0 && (
                <span className="text-red-600">⚠️ {summary.clientHealth.atRisk} en riesgo</span>
              )}
            </div>
          </div>
        )}

        {summary.recommendations && summary.recommendations.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] font-medium">Acciones recomendadas:</p>
            {summary.recommendations.slice(0, 3).map((r: any, i: number) => (
              <div
                key={i}
                className={`border-border bg-card rounded border p-1.5 text-[10px] ${r.priority === 'HIGH' ? 'border-l-2 border-red-500' : r.priority === 'MEDIUM' ? 'border-l-2 border-yellow-500' : 'border-l-2 border-green-500'}`}
              >
                <span
                  className={`inline-block rounded px-1 py-0.5 text-[9px] font-medium ${r.priority === 'HIGH' ? 'bg-red-100 text-red-700' : r.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}
                >
                  {r.priority}
                </span>
                <p className="mt-0.5">{r.action}</p>
                <p className="text-muted-foreground">{r.impact}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Inventory summary rendering
  if (d.summary && d.lowStock !== undefined && d.topMovers !== undefined) {
    const inv = d as Record<string, any>;
    const s = inv.summary;

    return (
      <div className="mt-2 space-y-2 text-[11px]">
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="border-border bg-card rounded border p-1.5">
            <span className="text-muted-foreground">Productos totales</span>
            <p className="font-medium">
              {s.totalProducts} ({s.activeProducts} activos, {s.trackedProducts} con stock)
            </p>
          </div>
          <div className="border-border bg-card rounded border p-1.5">
            <span className="text-muted-foreground">Unidades en mano</span>
            <p className="font-medium">{s.unitsOnHand.toLocaleString()}</p>
          </div>
          <div className="border-border bg-card rounded border p-1.5">
            <span className="text-muted-foreground">Valor inventario (costo)</span>
            <p className="font-medium">${Number(s.inventoryValue || 0).toLocaleString()}</p>
          </div>
          <div className="border-border bg-card rounded border p-1.5">
            <span className="text-muted-foreground">Ingreso potencial (precio)</span>
            <p className="font-medium">${Number(s.potentialRevenue || 0).toLocaleString()}</p>
          </div>
          <div className="border-border bg-card rounded border p-1.5">
            <span className="text-muted-foreground">Sin stock</span>
            <p className={`font-medium ${s.sinStock > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {s.sinStock}
            </p>
          </div>
          <div className="border-border bg-card rounded border p-1.5">
            <span className="text-muted-foreground">Stock bajo</span>
            <p className={`font-medium ${s.lowStock > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
              {s.lowStock}
            </p>
          </div>
        </div>

        {inv.lowStock && inv.lowStock.length > 0 && (
          <div className="rounded border border-yellow-200 bg-yellow-50 p-2">
            <p className="mb-1 font-medium text-yellow-700">
              ⚠️ {inv.lowStock.length} producto{inv.lowStock.length > 1 ? 's' : ''} con stock bajo
            </p>
            <div className="max-h-32 space-y-1 overflow-auto">
              {inv.lowStock.slice(0, 8).map((p: any, i: number) => (
                <div
                  key={i}
                  className="flex justify-between rounded bg-white/50 px-1.5 py-0.5 text-[10px]"
                >
                  <span>
                    {p.name} ({p.sku})
                  </span>
                  <span className="font-medium text-red-600">
                    {p.stock}/{p.minStock}{' '}
                    <span className="text-muted-foreground">(faltan {p.deficit})</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {inv.topMovers && inv.topMovers.length > 0 && (
          <div className="border-border bg-card rounded border p-2">
            <p className="mb-1 font-medium">📈 Top movidos (30 días)</p>
            <div className="space-y-1">
              {inv.topMovers.slice(0, 5).map((m: any, i: number) => (
                <div key={i} className="flex justify-between text-[10px]">
                  <span className="truncate pr-2">
                    {m.name} ({m.sku})
                  </span>
                  <span className="font-medium">{m.movedQuantity} und</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <pre className="text-muted-foreground mt-2 max-h-24 overflow-auto text-[10px]">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export function AiCopilot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        '¡Hola! Soy tu Copilot de IA. Pregúntame sobre ventas, clientes, oportunidades, tareas o inventario.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post<{ data: { message: string; data?: unknown } }>('/ai/query', {
        query: input,
      });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.data.message, data: res.data.data },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Lo siento, ocurrió un error al procesar tu consulta.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(!open)}
        className={cn(
          'fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full shadow-lg transition-all duration-300',
          open && 'scale-0 opacity-0',
        )}
      >
        <Sparkles className="h-5 w-5" />
      </Button>

      <div
        className={cn(
          'border-border bg-card fixed bottom-6 right-6 z-40 w-80 rounded-xl border shadow-2xl transition-all duration-300 sm:w-96',
          open ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0',
        )}
      >
        <div className="border-border flex items-center justify-between border-b p-3">
          <div className="flex items-center gap-2">
            <div className="bg-primary/20 flex h-7 w-7 items-center justify-center rounded-full">
              <Sparkles className="text-primary h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-medium">AI Business Copilot</span>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-80 space-y-3 overflow-y-auto p-3">
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex gap-2', msg.role === 'user' && 'flex-row-reverse')}>
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                  msg.role === 'assistant' ? 'bg-primary/20' : 'bg-secondary',
                )}
              >
                {msg.role === 'assistant' ? (
                  <Bot className="text-primary h-3.5 w-3.5" />
                ) : (
                  <User className="text-muted-foreground h-3.5 w-3.5" />
                )}
              </div>
              <div
                className={cn(
                  'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                  msg.role === 'assistant'
                    ? 'bg-secondary text-foreground'
                    : 'bg-primary text-primary-foreground',
                )}
              >
                <p>{msg.content}</p>
                {msg.data ? renderData(msg.data) : null}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-2">
              <div className="bg-primary/20 flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                <Loader2 className="text-primary h-3.5 w-3.5 animate-spin" />
              </div>
              <div className="bg-secondary text-muted-foreground rounded-lg px-3 py-2 text-sm">
                Pensando...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-border border-t p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregunta algo..."
              className="h-9 text-sm"
            />
            <Button
              type="submit"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={loading || !input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
