'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { acceptInvitationSchema } from '@nexa/shared';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell } from '@/components/auth/auth-shell';
import { Loader2, CheckCircle } from 'lucide-react';

type FormData = { firstName: string; lastName: string; password: string };

function AcceptInvitationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(acceptInvitationSchema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      setError('');
      await api.post('/auth/accept-invitation', { token, ...data });
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    }
  };

  if (!token) {
    return (
      <AuthShell
        title="Invitación inválida"
        subtitle="El enlace falta o venció. Pedile a quien te invitó uno nuevo."
      >
        <Button variant="ink" className="w-full" onClick={() => router.push('/login')}>
          Ir a iniciar sesión
        </Button>
      </AuthShell>
    );
  }

  if (success) {
    return (
      <AuthShell title="Invitación aceptada" subtitle="Ya forms parte de la organización.">
        <div className="space-y-4 text-center">
          <span className="numeral bg-verde text-paper mx-auto inline-flex h-12 w-12 items-center justify-center text-[16px]">
            <CheckCircle className="h-6 w-6" strokeWidth={1.7} />
          </span>
          <p className="font-display text-[19px] leading-snug">Ya estás adentro.</p>
          <p className="text-ink-3 text-sm">Iniciá sesión para entrar al CRM.</p>
        </div>
        <Button variant="ink" className="mt-4 w-full" onClick={() => router.push('/login')}>
          Iniciar sesión
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Aceptar invitación" subtitle="Terminá tu perfil y entrá a la organización.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="border-alizarin/40 bg-alizarin/10 eyebrow text-alizarin border px-3 py-2">
            {error}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="firstName" className="eyebrow">
            Nombre
          </Label>
          <Input id="firstName" placeholder="Tu nombre" {...register('firstName')} />
          {errors.firstName && <p className="eyebrow text-alizarin">{errors.firstName.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName" className="eyebrow">
            Apellido
          </Label>
          <Input id="lastName" placeholder="Tu apellido" {...register('lastName')} />
          {errors.lastName && <p className="eyebrow text-alizarin">{errors.lastName.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="eyebrow">
            Contraseña
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="Mínimo 8 caracteres"
            {...register('password')}
          />
          {errors.password && <p className="eyebrow text-alizarin">{errors.password.message}</p>}
        </div>
        <Button type="submit" variant="ink" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Aceptando…
            </>
          ) : (
            'Aceptar invitación'
          )}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Cargando…">
          <div className="flex justify-center py-6">
            <Loader2 className="text-cobalt h-6 w-6 animate-spin" />
          </div>
        </AuthShell>
      }
    >
      <AcceptInvitationForm />
    </Suspense>
  );
}
