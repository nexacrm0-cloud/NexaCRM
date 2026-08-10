'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageCircle,
  Mail,
  Bell,
  Receipt,
  Clock,
  Sparkles,
  ArrowUpCircle,
  Search,
  Loader2,
  Plug,
  Wand2,
  ShoppingBag,
  Settings,
  Trophy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { api } from '@/lib/api-client';
import { usePlan } from '@/hooks/use-plan';
import { usePermissions } from '@/hooks/use-permissions';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Stamp } from '@/components/ui/stamp';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

type TemplateParamField = {
  key: string;
  label: string;
  type: 'text' | 'url' | 'longtext' | 'select';
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: Array<{ value: string; label: string }>;
};

type Template = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  longDescription: string | null;
  category: string;
  icon: string | null;
  trigger: string;
  plan: string;
  priceCents: number;
  paramSchema: { fields?: TemplateParamField[] };
  defaultConfig: Record<string, unknown>;
  isFeatured: boolean;
  installCount: number;
};

const ICONS: Record<string, LucideIcon> = {
  MessageCircle,
  Mail,
  Bell,
  Receipt,
  Clock,
  Sparkles,
  Plug,
};

function iconFor(slug: string | null | undefined): LucideIcon {
  return ICONS[slug ?? ''] ?? Wand2;
}

export default function TemplatesMarketplacePage() {
  const router = useRouter();
  const { isStarter } = usePlan();
  const { canManageSettings } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Todas');
  const [installTarget, setInstallTarget] = useState<Template | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['workflowTemplates', activeCategory, search],
    queryFn: () =>
      api.get<{ data: Template[] }>(
        `/automation/templates${search ? `?search=${encodeURIComponent(search)}` : ''}`,
      ),
    enabled: isStarter,
  });

  const templates = data?.data ?? [];
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const t of templates) set.add(t.category);
    return ['Todas', ...Array.from(set).sort()];
  }, [templates]);

  const visible = useMemo(() => {
    if (activeCategory === 'Todas') return templates;
    return templates.filter((t) => t.category === activeCategory);
  }, [templates, activeCategory]);

  const heroFeature = useMemo(() => templates.find((t) => t.isFeatured), [templates]);
  const topByInstalls = useMemo(
    () => [...templates].sort((a, b) => b.installCount - a.installCount).slice(0, 3),
    [templates],
  );

  const installMutation = useMutation({
    mutationFn: (input: { slug: string; params: Record<string, unknown> }) =>
      api.post<Template>('/automation/templates/install', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['workflowTemplates'] });
      toast({ title: 'Automatización instalada', description: 'Ya quedó activa en tu workspace.' });
      setInstallTarget(null);
      router.push('/automation');
    },
    onError: (err: Error) =>
      toast({
        title: 'No pudimos instalarla',
        description: err.message,
        variant: 'destructive',
      }),
  });

  if (!isStarter) {
    return (
      <div className="fade-up mx-auto max-w-2xl py-12">
        <EmptyState
          icon={ArrowUpCircle}
          title="Disponible desde el plan Starter"
          description="El marketplace de automatizaciones y agentes se desbloquea a partir del plan Starter."
          action={
            <Button onClick={() => router.push('/pricing')} variant="ink">
              Ver planes
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <PageHeader
        eyebrow="Marketplace"
        title="Plantillas de automatización"
        description="Instalá agentes listos para usar. Conectan eventos de tu CRM con tus flujos en n8n."
        actions={
          canManageSettings && (
            <Button variant="outline" size="sm" onClick={() => router.push('/automation/admin')}>
              <Settings className="mr-2 h-3.5 w-3.5" />
              Gestor owner
            </Button>
          )
        }
      />

      <section className="border-ink/14 bg-ink/14 fade-up grid gap-px border md:grid-cols-3">
        <div className="bg-receipt px-5 py-5">
          <p className="eyebrow text-ink-3">01 · Plantillas disponibles</p>
          <p className="numeral text-naranja tabular mt-3 text-[36px]">
            {String(templates.length).padStart(2, '0')}
          </p>
          <p className="eyebrow text-ink-3 mt-2">En el catálogo</p>
        </div>
        <div className="bg-receipt px-5 py-5">
          <p className="eyebrow text-ink-3">02 · Categorías</p>
          <p className="numeral tabular mt-3 text-[36px]">
            {String(Math.max(0, categories.length - 1)).padStart(2, '0')}
          </p>
          <p className="eyebrow text-ink-3 mt-2">De uso habitual</p>
        </div>
        <div className="bg-receipt px-5 py-5">
          <p className="eyebrow text-ink-3">03 · Instalaciones totales</p>
          <p className="numeral text-verde tabular mt-3 text-[36px]">
            {String(templates.reduce((acc, t) => acc + t.installCount, 0)).padStart(2, '0')}
          </p>
          <p className="eyebrow text-ink-3 mt-2">Instancias activas</p>
        </div>
      </section>

      {heroFeature && !isLoading && (
        <section className="fade-up" style={{ animationDelay: '40ms' }}>
          <div className="border-ink/14 bg-ink/14 grid gap-px border md:grid-cols-[1fr_2fr]">
            <div className="bg-ink text-paper-1 flex flex-col justify-between p-6">
              <div>
                <p className="eyebrow mb-3 opacity-70">Destacado de la semana</p>
                <p className="font-display text-[26px] leading-tight">{heroFeature.name}</p>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <Stamp tone="cobalt" size="sm" rotate={-2}>
                  RECOMENDADO
                </Stamp>
                <p className="eyebrow opacity-70">{heroFeature.installCount} instalaciones</p>
              </div>
            </div>
            <div className="bg-receipt flex flex-col justify-between gap-4 p-6">
              <p className="text-ink leading-relaxed">{heroFeature.shortDescription}</p>
              <div className="flex items-center gap-3">
                <span className="eyebrow text-ink-3 inline-flex items-center gap-1.5">
                  <Bell className="h-3 w-3" strokeWidth={1.5} />
                  Dispara con: {heroFeature.trigger}
                </span>
                <Button variant="ink" size="sm" onClick={() => setInstallTarget(heroFeature)}>
                  Instalar ahora
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {topByInstalls.length > 0 && (topByInstalls[0]?.installCount ?? 0) > 0 && (
        <section className="fade-up" style={{ animationDelay: '80ms' }}>
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="text-naranja h-4 w-4" strokeWidth={1.5} />
            <h2 className="font-display text-[20px]">Lo que más instala la gente</h2>
          </div>
          <div className="border-ink/14 bg-ink/14 grid gap-px border md:grid-cols-3">
            {topByInstalls.map((t, i) => {
              const Icon = iconFor(t.icon);
              return (
                <button
                  key={t.id}
                  onClick={() => setInstallTarget(t)}
                  className="bg-receipt hover:bg-paper-2 group p-4 text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="border-ink/22 bg-paper-1 border p-2">
                      <Icon className="text-ink h-4 w-4" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1">
                      <p className="eyebrow text-ink-3">
                        #{i + 1} · {t.category}
                      </p>
                      <p className="font-display mt-0.5 text-[15px] leading-tight">{t.name}</p>
                    </div>
                    <p className="numeral text-naranja tabular text-[22px]">{t.installCount}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className="fade-up flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const active = cat === activeCategory;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`eyebrow border px-3 py-1.5 transition-colors ${
                  active ? 'bg-ink text-paper-1 border-ink' : 'border-ink/22 hover:border-ink/40'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
        <div className="relative w-full max-w-sm">
          <Search
            className="text-ink-3 pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            strokeWidth={1.5}
          />
          <Input
            placeholder="Buscar plantilla…"
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-5">
                <div className="bg-ink/10 h-5 w-32 animate-pulse" />
                <div className="bg-ink/10 h-3 w-full animate-pulse" />
                <div className="bg-ink/10 h-3 w-2/3 animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={ShoppingBag}
              title="No hay plantillas para esta búsqueda"
              description="Probá con otra categoría o limpiá el filtro."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="fade-up grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => {
            const Icon = iconFor(t.icon);
            const featured = t.isFeatured;
            return (
              <Card key={t.id} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col gap-4 p-5">
                  <div className="flex items-start justify-between">
                    <div className="border-ink/22 bg-paper-1 border p-2">
                      <Icon className="text-ink h-5 w-5" strokeWidth={1.5} />
                    </div>
                    {featured ? (
                      <Stamp tone="cobalt" size="sm" rotate={-2}>
                        DESTACADO
                      </Stamp>
                    ) : (
                      <Stamp tone="mute" size="sm" rotate={1.5}>
                        {t.category.toUpperCase()}
                      </Stamp>
                    )}
                  </div>

                  <div>
                    <p className="eyebrow text-ink-3">{t.trigger}</p>
                    <h3 className="font-display mt-1 text-[22px] leading-tight">{t.name}</h3>
                    <p className="text-ink-3 mt-2 text-sm leading-relaxed">{t.shortDescription}</p>
                  </div>

                  <div className="mt-auto flex items-center gap-2">
                    <span className="eyebrow text-ink-3 inline-flex items-center gap-1.5">
                      <Bell className="h-3 w-3" strokeWidth={1.5} />
                      {t.plan}
                    </span>
                    <span className="text-ink/22">·</span>
                    <span className="eyebrow text-ink-3">{t.installCount} instalaciones</span>
                  </div>

                  <Button
                    variant="ink"
                    size="sm"
                    className="w-full"
                    onClick={() => setInstallTarget(t)}
                  >
                    Instalar
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {installTarget && (
        <InstallDialog
          template={installTarget}
          open={!!installTarget}
          onOpenChange={(o) => !o && setInstallTarget(null)}
          onSubmit={(params) => installMutation.mutate({ slug: installTarget.slug, params })}
          isPending={installMutation.isPending}
        />
      )}
    </div>
  );
}

function InstallDialog({
  template,
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: {
  template: Template;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (params: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const Icon = iconFor(template.icon);
  const fields = template.paramSchema?.fields ?? [];
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of fields) {
      const def = (template.defaultConfig as Record<string, unknown>)[f.key];
      initial[f.key] = typeof def === 'string' ? def : '';
    }
    return initial;
  });

  const canSubmit = useMemo(() => {
    return fields.every((f) => {
      if (!f.required) return true;
      const v = values[f.key];
      return !!v && v.trim().length > 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, fields.length]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-3">
            <div className="border-ink/22 bg-paper-1 border p-2">
              <Icon className="text-ink h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <p className="eyebrow text-ink-3">{template.category}</p>
              <p className="eyebrow text-ink-3 font-mono">{template.trigger}</p>
            </div>
          </div>
          <DialogTitle className="font-display">{template.name}</DialogTitle>
          {template.longDescription && (
            <DialogDescription>{template.longDescription}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <label className="eyebrow text-ink-3">
                {f.label}
                {f.required && <span className="text-alizarin ml-1">*</span>}
              </label>

              {f.type === 'longtext' ? (
                <textarea
                  className="border-ink/22 bg-paper-1 focus:border-ink min-h-[88px] w-full border px-3 py-2 font-mono text-sm focus:outline-none"
                  value={values[f.key] ?? ''}
                  placeholder={f.placeholder}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              ) : f.type === 'select' ? (
                <select
                  className="border-ink/22 bg-paper-1 focus:border-ink h-10 w-full border px-3 font-mono text-sm focus:outline-none"
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                >
                  <option value="">Seleccioná…</option>
                  {(f.options ?? []).map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  type={f.type === 'url' ? 'url' : 'text'}
                  value={values[f.key] ?? ''}
                  placeholder={f.placeholder}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              )}
              {f.helpText && <p className="text-ink-3 mt-1 text-[11px]">{f.helpText}</p>}
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="ink"
            size="sm"
            disabled={!canSubmit || isPending}
            onClick={() => onSubmit(values as Record<string, unknown>)}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="mr-2 h-3.5 w-3.5" />
            )}
            Instalar y activar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
