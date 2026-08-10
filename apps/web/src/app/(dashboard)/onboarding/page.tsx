'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardEyebrow } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  CheckCircle,
  Building2,
  Target,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  Sparkles,
} from 'lucide-react';

const CURRENCIES = [
  { code: 'ARS', label: 'Peso argentino', symbol: '$' },
  { code: 'USD', label: 'Dólar estadounidense', symbol: 'US$' },
  { code: 'MXN', label: 'Peso mexicano', symbol: 'Mex$' },
  { code: 'COP', label: 'Peso colombiano', symbol: 'Col$' },
  { code: 'CLP', label: 'Peso chileno', symbol: 'CLP' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'BRL', label: 'Real brasileño', symbol: 'R$' },
  { code: 'PEN', label: 'Sol peruano', symbol: 'S/' },
  { code: 'UYU', label: 'Peso uruguayo', symbol: '$U' },
];

const STEPS = [
  {
    title: 'Bienvenido a Nexa CRM',
    description:
      'En 5 pasos cortos dejás tu CRM listo para usar. Armamos tu primer cliente y tu primera oportunidad.',
    icon: Building2,
  },
  {
    title: 'Tu moneda',
    description:
      'Elegí la moneda que usa tu operación. Cambio cosmética en facturas, presupuestos y reportes.',
    icon: DollarSign,
  },
  {
    title: 'Tu primer cliente',
    description: 'Sumá el primer cliente con el que vas a operar. Después podés adicionar más.',
    icon: Building2,
  },
  {
    title: 'Tu primera oportunidad',
    description: 'Asigná un valor estimado y una etapa. La movés después cuando cambie.',
    icon: DollarSign,
  },
  {
    title: 'Todo listo',
    description: 'Vamos al dashboard. Ahí ves el pulso de tu negocio.',
    icon: Sparkles,
  },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [currency, setCurrency] = useState('ARS');
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [dealTitle, setDealTitle] = useState('');
  const [dealValue, setDealValue] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: stagesData } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['pipeline-stages'],
    queryFn: () => api.get<Array<{ id: string; name: string }>>('/pipeline/stages'),
    enabled: step >= 3,
  });

  const createClient = useMutation({
    mutationFn: () =>
      api.post('/clients', {
        companyName,
        contactName,
        email: email || undefined,
        tags: ['primer-cliente'],
      }),
    onSuccess: (res: any) => {
      toast({ title: 'Cliente creado', variant: 'success' });
      setClientId(res.data?.id ?? res.id);
      setStep(3);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const createDeal = useMutation({
    mutationFn: () => {
      const stage = stagesData?.[0]?.id;
      return api.post('/pipeline/deals', {
        title: dealTitle || `Oportunidad - ${companyName}`,
        value: dealValue ? parseFloat(dealValue) : 0,
        clientId,
        stageId: stage,
      });
    },
    onSuccess: () => {
      toast({ title: 'Oportunidad creada', variant: 'success' });
      setStep(4);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const completeOnboarding = useMutation({
    mutationFn: () => api.post('/auth/complete-onboarding', { currency }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      router.push('/dashboard');
    },
    onError: () => {
      router.push('/dashboard');
    },
  });

  const settingsMutation = useMutation({
    mutationFn: () => api.patch('/settings', { currency }),
    onSuccess: () => {
      toast({ title: `Moneda configurada: ${currency}`, variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setStep(2);
    },
    onError: (err: Error) => {
      toast({ title: 'Error al guardar moneda', description: err.message, variant: 'destructive' });
    },
  });

  const handleNext = () => {
    if (step === 1) {
      // Currency picked — persist immediately so settings reflect it before the org is "complete"
      settingsMutation.mutate();
      return;
    }
    if (step === 2) {
      if (!companyName || !contactName) {
        toast({
          title: 'Completa los campos',
          description: 'Empresa y contacto son requeridos',
          variant: 'destructive',
        });
        return;
      }
      createClient.mutate();
    } else if (step === 3) {
      if (!dealTitle && !companyName) {
        toast({
          title: 'Completá los campos',
          description: 'Ingresá un nombre para la oportunidad',
          variant: 'destructive',
        });
        return;
      }
      createDeal.mutate();
    } else if (step === 4) {
      completeOnboarding.mutate();
    } else {
      setStep(step + 1);
    }
  };

  const current = STEPS[step]!;

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <header className="border-ink/22 fade-up border-b pb-6">
        <p className="eyebrow mb-3">Onboarding · Paso {String(step + 1).padStart(2, '0')} / 05</p>
        <h1 className="font-display text-[36px] leading-[1.05] tracking-[-0.025em]">
          {current.title}
        </h1>
        <p className="text-ink-3 mt-2 max-w-prose">{current.description}</p>
      </header>

      <div
        className="fade-up flex items-center gap-2"
        style={{ animationDelay: '60ms' }}
        aria-label="Progreso"
      >
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 transition-colors ${i <= step ? 'bg-ink' : 'bg-ink/14'}`}
          />
        ))}
      </div>

      <Card className="fade-up" style={{ animationDelay: '120ms' }}>
        <CardEyebrow className="eyebrow flex items-center justify-between">
          <span>Paso {String(step + 1).padStart(2, '0')}</span>
          <span className="numeral bg-ink text-paper inline-flex h-7 w-7 items-center justify-center text-[12px]">
            {String(step + 1)}
          </span>
        </CardEyebrow>
        <CardContent className="pt-5">
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-ink-3 text-sm">
                Esto define cómo se muestran los importes en facturas, presupuestos y reportes.
                Podés cambiarla después en Configuración.
              </p>
              <div className="space-y-2">
                <Label htmlFor="currency" className="eyebrow">
                  Moneda *
                </Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="currency" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        <span className="mr-2 font-mono">{c.symbol}</span>
                        {c.label} ({c.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="border-ink/14 bg-paper-2 rounded-lg border p-3 text-sm">
                <span className="eyebrow text-ink-3">Vista previa</span>
                <p className="numeral text-ink mt-1 text-[26px]">
                  {currency === 'ARS'
                    ? '$ 1.500,00'
                    : currency === 'USD'
                      ? 'US$1,500.00'
                      : currency === 'EUR'
                        ? '€1,500.00'
                        : currency === 'CLP'
                          ? '$1.500'
                          : `${currency} 1,500.00`}
                </p>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName" className="eyebrow">
                  Nombre de la empresa *
                </Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ej: TechCorp S.A."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactName" className="eyebrow">
                  Nombre del contacto *
                </Label>
                <Input
                  id="contactName"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="eyebrow">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="juan@techcorp.com"
                />
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dealTitle" className="eyebrow">
                  Nombre de la oportunidad
                </Label>
                <Input
                  id="dealTitle"
                  value={dealTitle}
                  onChange={(e) => setDealTitle(e.target.value)}
                  placeholder={`Oportunidad - ${companyName || 'Mi cliente'}`}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dealValue" className="eyebrow">
                  Valor estimado ({currency})
                </Label>
                <Input
                  id="dealValue"
                  type="number"
                  min="0"
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                  placeholder="Ej: 5000"
                />
              </div>
              <p className="eyebrow text-ink-3">
                Se creará en la primera etapa del pipeline. La movés cuando cambie.
              </p>
            </div>
          )}
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-sm">En este breve tutorial vamos a:</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-3">
                  <Building2 className="text-ink-3 h-4 w-4" strokeWidth={1.5} /> Crear tu primer
                  cliente
                </li>
                <li className="flex items-center gap-3">
                  <DollarSign className="text-ink-3 h-4 w-4" strokeWidth={1.5} /> Registrar tu
                  primera oportunidad
                </li>
                <li className="flex items-center gap-3">
                  <Target className="text-ink-3 h-4 w-4" strokeWidth={1.5} /> Explorar el dashboard
                </li>
                <li className="flex items-center gap-3">
                  <Sparkles className="text-ink-3 h-4 w-4" strokeWidth={1.5} /> Conocer el Command
                  Center (Ctrl+K)
                </li>
              </ul>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-5 py-2">
              <div className="flex flex-col items-center text-center">
                <span className="numeral bg-verde text-paper mb-3 inline-flex h-14 w-14 items-center justify-center text-[16px]">
                  <CheckCircle className="h-7 w-7" strokeWidth={1.7} />
                </span>
                <p className="font-display max-w-sm text-[19px] leading-snug">
                  Listo. Tu CRM tiene lo mínimo para empezar a operar.
                </p>
              </div>
              <ul className="divide-ink/10 divide-y">
                <li className="flex items-center gap-3 py-2.5">
                  <CheckCircle className="text-verde h-4 w-4 shrink-0" strokeWidth={1.8} />
                  <span className="text-sm">Moneda configurada ({currency})</span>
                </li>
                <li className="flex items-center gap-3 py-2.5">
                  <CheckCircle className="text-verde h-4 w-4 shrink-0" strokeWidth={1.8} />
                  <span className="text-sm">
                    Cliente <strong className="numeral">{companyName}</strong> creado
                  </span>
                </li>
                <li className="flex items-center gap-3 py-2.5">
                  <CheckCircle className="text-verde h-4 w-4 shrink-0" strokeWidth={1.8} />
                  <span className="text-sm">
                    Oportunidad{' '}
                    <strong className="numeral">
                      {dealTitle || `Oportunidad - ${companyName}`}
                    </strong>{' '}
                    creada
                  </span>
                </li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <div
        className="fade-up flex items-center justify-between"
        style={{ animationDelay: '180ms' }}
      >
        <div className="flex items-center gap-2">
          {step > 0 && step < 4 && (
            <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="mr-2 h-3.5 w-3.5" /> Atrás
            </Button>
          )}
          {step < 4 && (
            <Button
              variant="link"
              size="sm"
              onClick={() => completeOnboarding.mutate()}
              disabled={completeOnboarding.isPending}
              className="text-ink-3 px-0"
            >
              Saltar tutorial
            </Button>
          )}
        </div>
        <Button
          variant="ink"
          size="sm"
          onClick={handleNext}
          disabled={
            (step === 2 && createClient.isPending) ||
            (step === 3 && createDeal.isPending) ||
            (step === 1 && settingsMutation.isPending) ||
            completeOnboarding.isPending
          }
        >
          {step === 4
            ? completeOnboarding.isPending
              ? 'Completando…'
              : 'Ir al dashboard'
            : settingsMutation.isPending
              ? 'Guardando moneda…'
              : createClient.isPending
                ? 'Creando cliente…'
                : createDeal.isPending
                  ? 'Creando oportunidad…'
                  : 'Siguiente'}
          {step !== 4 && <ArrowRight className="ml-2 h-3.5 w-3.5" />}
        </Button>
      </div>

      {current && <span className="sr-only">{current.title}</span>}
    </div>
  );
}
