'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema } from '@nexa/shared';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell } from '@/components/auth/auth-shell';
import { Loader2, CheckCircle } from 'lucide-react';

type FormData = { password: string };

function ResetPasswordForm() {
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
    resolver: zodResolver(resetPasswordSchema.omit({ token: true })),
  });

  const onSubmit = async (data: FormData) => {
    try {
      setError('');
      await api.post('/auth/reset-password', { token, password: data.password });
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    }
  };

  if (!token) {
    return (
      <AuthShell title="Enlace inválido" subtitle="El token falta o venció. Pedí uno nuevo.">
        <Button variant="ink" className="w-full" onClick={() => router.push('/forgot-password')}>
          Pedir enlace nuevo
        </Button>
      </AuthShell>
    );
  }

  if (success) {
    return (
      <AuthShell title="Contraseña restablecida" subtitle="Ya podés iniciar sesión con la nueva.">
        <div className="space-y-4 text-center">
          <span className="numeral bg-verde text-paper mx-auto inline-flex h-12 w-12 items-center justify-center text-[16px]">
            <CheckCircle className="h-6 w-6" strokeWidth={1.7} />
          </span>
          <p className="font-display text-[19px] leading-snug">Listo. Cambiaste la contraseña.</p>
        </div>
        <Button variant="ink" className="mt-4 w-full" onClick={() => router.push('/login')}>
          Iniciar sesión
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Nueva contraseña" subtitle="Elegí una contraseña nueva para tu cuenta.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="border-alizarin/40 bg-alizarin/10 eyebrow text-alizarin border px-3 py-2">
            {error}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="password" className="eyebrow">
            Nueva contraseña
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
              Restableciendo…
            </>
          ) : (
            'Restablecer contraseña'
          )}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
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
      <ResetPasswordForm />
    </Suspense>
  );
}
