'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Command } from 'cmdk';
import { api } from '@/lib/api-client';
import { useRouter } from 'next/navigation';
import {
  Search,
  Users,
  KanbanSquare,
  CheckSquare,
  FileText,
  Sparkles,
  Loader2,
  Plus,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    message: string;
    data?: unknown;
    action?: { tool: string; parameters: Record<string, unknown>; result?: unknown };
  } | null>(null);
  const [mode, setMode] = useState<'search' | 'ai'>('search');
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery('');
        setResult(null);
        setMode('search');
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleQuery = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setMode('ai');
    try {
      const res = await api.post<{
        data: {
          message: string;
          data?: unknown;
          action?: { tool: string; parameters: Record<string, unknown>; result?: unknown };
        };
      }>('/ai/command', { query: q });
      setResult(res.data);
    } catch {
      setResult({ message: 'Error al procesar el comando. Intenta de nuevo.' });
    } finally {
      setLoading(false);
    }
  }, []);

  const navigateTo = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router],
  );

  const quickActions = [
    {
      id: 'new-client',
      label: 'Crear cliente',
      icon: Plus,
      action: () => navigateTo('/clients?new=true'),
    },
    {
      id: 'new-deal',
      label: 'Nueva oportunidad',
      icon: Plus,
      action: () => navigateTo('/pipeline?new=true'),
    },
    {
      id: 'new-task',
      label: 'Nueva tarea',
      icon: Plus,
      action: () => navigateTo('/tasks?new=true'),
    },
    { id: 'go-clients', label: 'Ir a Clientes', icon: Users, action: () => navigateTo('/clients') },
    {
      id: 'go-pipeline',
      label: 'Ir a Pipeline',
      icon: KanbanSquare,
      action: () => navigateTo('/pipeline'),
    },
    { id: 'go-tasks', label: 'Ir a Tareas', icon: CheckSquare, action: () => navigateTo('/tasks') },
    {
      id: 'go-quotes',
      label: 'Ir a Presupuestos',
      icon: FileText,
      action: () => navigateTo('/quotes'),
    },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="border-border bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground flex w-64 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-all"
      >
        <Search className="h-4 w-4" />
        <span>Buscar o preguntar...</span>
        <kbd className="border-border bg-muted text-muted-foreground ml-auto hidden items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium sm:inline-flex">
          <span>⌘</span>K
        </kbd>
      </button>

      <Command.Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setQuery('');
            setResult(null);
            setMode('search');
          }
        }}
        label="Command Palette"
        className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      >
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
        <div className="border-border bg-card relative w-full max-w-xl overflow-hidden rounded-xl border shadow-2xl">
          <div className="border-border flex items-center border-b px-3">
            <Search className="text-muted-foreground h-4 w-4 shrink-0" />
            <Command.Input
              ref={inputRef}
              value={query}
              onValueChange={(q) => {
                setQuery(q);
                if (!q) {
                  setResult(null);
                  setMode('search');
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query.trim()) {
                  handleQuery(query);
                }
              }}
              placeholder="Escribe en lenguaje natural o busca..."
              className="placeholder:text-muted-foreground flex h-11 w-full bg-transparent px-2 text-sm outline-none"
            />
            {query && (
              <button
                onClick={() => handleQuery(query)}
                disabled={loading}
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors"
              >
                {loading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                {loading ? 'Pensando...' : 'Preguntar'}
              </button>
            )}
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            {mode === 'search' && !query && (
              <Command.Group heading="Acciones rápidas">
                {quickActions.map((action) => (
                  <Command.Item
                    key={action.id}
                    onSelect={action.action}
                    className="data-[selected]:bg-accent flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
                  >
                    <action.icon className="text-muted-foreground h-4 w-4" />
                    <span>{action.label}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {mode === 'search' && query && (
              <Command.Group heading="Resultados">
                <Command.Item
                  onSelect={() => handleQuery(query)}
                  className="data-[selected]:bg-accent flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
                >
                  <Sparkles className="text-primary h-4 w-4" />
                  <span>Preguntar a IA: &ldquo;{query}&rdquo;</span>
                </Command.Item>
              </Command.Group>
            )}

            {mode === 'ai' && loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-primary h-6 w-6 animate-spin" />
              </div>
            )}

            {mode === 'ai' && result && !loading && (
              <div className="space-y-3 p-3">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/20 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                    <Sparkles className="text-primary h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm">{result.message}</p>
                    {result.data ? (
                      <div className="bg-secondary/50 rounded-lg p-3">
                        <pre className="text-muted-foreground max-h-40 overflow-auto text-xs">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="border-border flex gap-2 border-t pt-2">
                  <button
                    onClick={() => {
                      setQuery('');
                      setResult(null);
                      setMode('search');
                      inputRef.current?.focus();
                    }}
                    className="text-muted-foreground hover:bg-secondary flex items-center gap-1 rounded-md px-3 py-1.5 text-xs transition-colors"
                  >
                    Nueva consulta
                  </button>
                </div>
              </div>
            )}

            <Command.Empty className="text-muted-foreground py-6 text-center text-sm">
              {query ? 'Presiona Enter para preguntar a la IA' : 'Escribe para comenzar'}
            </Command.Empty>
          </Command.List>

          <div className="border-border flex items-center gap-4 border-t px-3 py-2">
            <div className="text-muted-foreground flex items-center gap-1 text-[10px]">
              <kbd className="border-border rounded border px-1 py-0.5">↑↓</kbd>
              <span>Navegar</span>
            </div>
            <div className="text-muted-foreground flex items-center gap-1 text-[10px]">
              <kbd className="border-border rounded border px-1 py-0.5">↵</kbd>
              <span>Seleccionar</span>
            </div>
            <div className="text-muted-foreground flex items-center gap-1 text-[10px]">
              <kbd className="border-border rounded border px-1 py-0.5">Esc</kbd>
              <span>Cerrar</span>
            </div>
          </div>
        </div>
      </Command.Dialog>
    </>
  );
}
