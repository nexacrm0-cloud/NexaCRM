import { Metadata } from 'next';
import Link from 'next/link';
import {
  MessageCircle,
  Mail,
  Bell,
  Receipt,
  Clock,
  Sparkles,
  Wand2,
  Plug,
  ArrowRight,
  CheckCircle2,
  Trophy,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Nexa Automation Pro — Agentes listos para tu CRM',
  description:
    'Plantillas de automatización que conectan tu CRM con WhatsApp, Slack, Mailchimp y tu back-office. Activá 14 días gratis, sin tarjeta.',
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const ICONS: Record<string, LucideIcon> = {
  MessageCircle,
  Mail,
  Bell,
  Receipt,
  Clock,
  Sparkles,
  Plug,
};

function iconFor(icon: string | null | undefined): LucideIcon {
  return ICONS[icon ?? ''] ?? Wand2;
}

type PublicTemplate = {
  slug: string;
  name: string;
  shortDescription: string;
  longDescription: string | null;
  category: string;
  icon: string | null;
  trigger: string;
  plan: string;
  priceCents: number;
  isFeatured: boolean;
  installCount: number;
};

type CatalogResponse = {
  data: PublicTemplate[];
  summary: {
    totalTemplates: number;
    totalInstalls: number;
    categories: string[];
  };
};

function formatCents(cents: number): string {
  if (!cents) return 'Gratis';
  const value = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(cents / 100);
  return `${value}/mes`;
}

async function getCatalog(): Promise<CatalogResponse> {
  try {
    const res = await fetch(`${API_BASE}/automation/public/catalog`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error('catalog unavailable');
    return (await res.json()) as CatalogResponse;
  } catch {
    return { data: [], summary: { totalTemplates: 0, totalInstalls: 0, categories: [] } };
  }
}

export default async function AutomationProLanding() {
  const { data: templates, summary } = await getCatalog();

  const hero = templates.find((t) => t.isFeatured) ?? templates[0] ?? null;
  const topByInstalls = [...templates].sort((a, b) => b.installCount - a.installCount).slice(0, 3);
  const rest = templates.filter((t) => t.slug !== hero?.slug);
  const categories = summary.categories;

  return (
    <main className="bg-paper text-ink min-h-screen">
      {/* HERO */}
      <section className="border-ink/14 border-b">
        <div className="mx-auto grid max-w-[1240px] items-start gap-12 px-6 py-16 md:grid-cols-[3fr_2fr] md:py-24">
          <div className="fade-up">
            <p className="eyebrow mb-5 inline-flex items-center gap-2">
              <Zap className="text-naranja h-3.5 w-3.5" strokeWidth={1.7} />
              NEXA · Automation Pro
            </p>
            <h1
              className="font-display text-[48px] font-medium leading-[1.02] tracking-[-0.025em] md:text-[64px]"
              style={{ textWrap: 'balance' }}
            >
              Agentes y automatizaciones que trabajan mientras dormís.
            </h1>
            <p className="text-ink-3 mt-5 max-w-xl text-[16px] leading-relaxed md:text-[18px]">
              Conectamos tu CRM con WhatsApp, Slack, Mailchimp y tu back-office. Activá cualquier
              plantilla y empezá con <strong className="text-ink">14 días de prueba gratis</strong>,
              sin tarjeta de crédito.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register?utm_source=automation-pro"
                className="bg-ink text-paper-1 hover:bg-ink/90 inline-flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors"
              >
                Empezar prueba gratis
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="border-ink/22 hover:border-ink/50 inline-flex items-center gap-2 border px-6 py-3 text-sm transition-colors"
              >
                Ya tengo cuenta
              </Link>
            </div>
            <p className="eyebrow text-ink-3 mt-6">
              {summary.totalTemplates} plantillas · {summary.totalInstalls}+ instalaciones activas ·
              cancelás cuando quieras
            </p>
          </div>

          {/* Highlight card */}
          {hero && (
            <aside
              className="bg-receipt border-ink/14 fade-up border p-8"
              style={{ animationDelay: '60ms' }}
            >
              <div className="mb-6 flex items-center justify-between">
                <span className="eyebrow text-ink-3">Destacado de la semana</span>
                <span className="eyebrow border-cobalt text-cobalt border-2 border-double px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]">
                  Recomendado
                </span>
              </div>
              <div className="border-ink/22 bg-paper-1 mb-5 w-fit border p-2.5">
                {(() => {
                  const Icon = iconFor(hero.icon);
                  return <Icon className="text-ink h-6 w-6" strokeWidth={1.5} />;
                })()}
              </div>
              <h2 className="font-display text-[26px] leading-tight">{hero.name}</h2>
              <p className="text-ink-3 mt-3 text-sm leading-relaxed">{hero.shortDescription}</p>
              <div className="border-ink/14 mt-6 flex items-center justify-between border-t pt-5">
                <div>
                  <p className="eyebrow text-ink-3">Precio</p>
                  <p className="font-display mt-1 text-[20px]">{formatCents(hero.priceCents)}</p>
                </div>
                <span className="eyebrow text-ink-3">{hero.installCount} instalaciones</span>
              </div>
            </aside>
          )}
        </div>
      </section>

      {/* VALUE PROPS */}
      <section className="border-ink/14 bg-receipt border-b">
        <div className="bg-ink/14 mx-auto grid max-w-[1240px] gap-px px-6 py-14 md:grid-cols-3">
          <article className="bg-receipt p-7">
            <p className="eyebrow text-naranja">01 · Trial honesto</p>
            <p className="font-display mt-3 text-[22px] leading-tight">
              14 días sin crédito, sin fricción
            </p>
            <p className="text-ink-3 mt-3 text-sm leading-relaxed">
              Activás cualquier plantilla y tenés dos semanas para decidir si te queda. Sin tarjeta,
              sin upsell raro.
            </p>
          </article>
          <article className="bg-receipt p-7">
            <p className="eyebrow text-naranja">02 · Cero código</p>
            <p className="font-display mt-3 text-[22px] leading-tight">
              Plantillas que saben lo que hacen
            </p>
            <p className="text-ink-3 mt-3 text-sm leading-relaxed">
              Conectan eventos del CRM con tu n8n o webhook. Pegan trigger + payload. Vos conectás y
              listo.
            </p>
          </article>
          <article className="bg-receipt p-7">
            <p className="eyebrow text-naranja">03 · Cobranza y control</p>
            <p className="font-display mt-3 text-[22px] leading-tight">
              Ves qué corre y cuándo se cobra
            </p>
            <p className="text-ink-3 mt-3 text-sm leading-relaxed">
              Portal de cliente con estado, último run y renovación. Cancelás con un toque, sin
              escribir un mail.
            </p>
          </article>
        </div>
      </section>

      {/* TOP INSTALLS */}
      {topByInstalls.length > 0 && (
        <section className="mx-auto max-w-[1240px] px-6 py-16">
          <div className="mb-6 flex items-center gap-2">
            <Trophy className="text-naranja h-5 w-5" strokeWidth={1.6} />
            <h2 className="font-display text-[28px]">Las que más usa la gente</h2>
          </div>
          <div className="border-ink/14 bg-ink/14 grid gap-px border md:grid-cols-3">
            {topByInstalls.map((t, i) => {
              const Icon = iconFor(t.icon);
              return (
                <div key={t.slug} className="bg-receipt flex flex-col gap-4 p-6">
                  <div className="flex items-center gap-3">
                    <div className="border-ink/22 bg-paper-1 border p-2">
                      <Icon className="text-ink h-4 w-4" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1">
                      <p className="eyebrow text-ink-3">
                        #{i + 1} · {t.category}
                      </p>
                      <p className="font-display mt-0.5 text-[16px] leading-tight">{t.name}</p>
                    </div>
                    <p className="numeral text-naranja tabular text-[24px]">{t.installCount}</p>
                  </div>
                  <p className="text-ink-3 text-sm leading-relaxed">{t.shortDescription}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* CATALOG */}
      <section className="mx-auto max-w-[1240px] px-6 pb-20">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h2 className="font-display text-[28px]">Catálogo completo</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <span key={c} className="eyebrow border-ink/22 text-ink-3 border px-3 py-1.5">
                {c}
              </span>
            ))}
          </div>
        </div>

        {rest.length === 0 ? (
          <p className="eyebrow text-ink-3 border-ink/14 bg-receipt border p-10 text-center">
            Volvé en breve. Estamos curando las próximas plantillas.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((t) => {
              const Icon = iconFor(t.icon);
              return (
                <article
                  key={t.slug}
                  className="bg-receipt border-ink/14 flex flex-col gap-4 border p-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="border-ink/22 bg-paper-1 border p-2">
                      <Icon className="text-ink h-5 w-5" strokeWidth={1.5} />
                    </div>
                    <span
                      className={`eyebrow border-2 border-double px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] ${
                        t.isFeatured ? 'border-cobalt text-cobalt' : 'border-ink/35 text-ink-3'
                      }`}
                    >
                      {t.isFeatured ? 'Destacado' : t.category}
                    </span>
                  </div>

                  <div>
                    <p className="eyebrow text-ink-3">{t.trigger}</p>
                    <h3 className="font-display mt-1 text-[20px] leading-tight">{t.name}</h3>
                    <p className="text-ink-3 mt-2 text-sm leading-relaxed">{t.shortDescription}</p>
                  </div>

                  <div className="border-ink/14 mt-auto flex items-center justify-between border-t pt-4">
                    <div>
                      <p className="eyebrow text-ink-3">Trial</p>
                      <p className="font-display mt-0.5 text-[16px]">{formatCents(t.priceCents)}</p>
                    </div>
                    <span className="eyebrow text-ink-3">{t.installCount} installs</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="border-ink/14 bg-ink text-paper-1 border-t">
        <div className="mx-auto max-w-[1240px] px-6 py-16 text-center">
          <h2 className="font-display text-[36px] leading-tight tracking-[-0.02em] md:text-[44px]">
            Activás. Probás. Si no te queda, cancelás.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] opacity-70">
            Sin permanencia, sin llamada comercial. La activación toma menos de un minuto.
          </p>
          <ul className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm">
            <li className="inline-flex items-center gap-2">
              <CheckCircle2 className="text-verde h-4 w-4" strokeWidth={1.7} />
              14 días de trial en cada plantilla
            </li>
            <li className="inline-flex items-center gap-2">
              <CheckCircle2 className="text-verde h-4 w-4" strokeWidth={1.7} />
              Portal de cliente con estado en vivo
            </li>
            <li className="inline-flex items-center gap-2">
              <CheckCircle2 className="text-verde h-4 w-4" strokeWidth={1.7} />
              Cancelás con un toque
            </li>
          </ul>
          <Link
            href="/register?utm_source=automation-pro"
            className="bg-paper-1 text-ink hover:bg-paper-2 mt-10 inline-flex items-center gap-2 px-7 py-3.5 text-sm font-medium transition-colors"
          >
            Crear mi cuenta
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-[1240px] px-6 py-10 text-center">
        <p className="eyebrow text-ink-3">
          ¿Tenés dudas?{' '}
          <Link href="mailto:hola@nexa.com.ar" className="text-naranja hover:underline">
            hola@nexa.com.ar
          </Link>
        </p>
      </footer>
    </main>
  );
}
