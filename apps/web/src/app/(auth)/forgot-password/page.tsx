'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema } from '@nexa/shared';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell } from '@/components/auth/auth-shell';
import { Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

type FormData = { email: string };

export default function ForgotPasswordPage() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      setError('');
      await api.post('/auth/forgot-password', data);
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    }
  };

  if (success) {
    return (
      <AuthShell
        title="Revisá tu email"
        subtitle="Si el email está registrado, te enviamos el enlace."
      >
        <div className="space-y-4 text-center">
          <span className="numeral bg-verde text-paper mx-auto inline-flex h-12 w-12 items-center justify-center text-[16px]">
            <CheckCircle className="h-6 w-6" strokeWidth={1.7} />
          </span>
          <p className="font-display text-[19px] leading-snug">
            Te enviamos un enlace de recuperación.
          </p>
          <p className="text-ink-3 text-sm">
            Si no aparece en algunos minutos, revisá spam o reintentá con el email que usás en Nexa.
          </p>
        </div>
        <Button
          variant="ink"
          className="mt-4 w-full"
          onClick={() => (window.location.href = '/login')}
        >
          Volver a iniciar sesión
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Restablecer contraseña" subtitle="Ingresá tu email y te enviamos un enlace.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="border-alizarin/40 bg-alizarin/10 eyebrow text-alizarin border px-3 py-2">
            {error}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email" className="eyebrow">
            Email
          </Label>
          <Input id="email" type="email" placeholder="tu@email.com" {...register('email')} />
          {errors.email && <p className="eyebrow text-alizarin">{errors.email.message}</p>}
        </div>
        <Button type="submit" variant="ink" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Enviando…
            </>
          ) : (
            'Enviar enlace'
          )}
        </Button>
      </form>
      <p className="eyebrow text-ink-3 border-ink/14 mt-6 border-t pt-4 text-center">
        <Link href="/login" className="hover:text-ink inline-flex items-center gap-2">
          <ArrowLeft className="h-3 w-3" />
          Volver a iniciar sesión
        </Link>
      </p>
    </AuthShell>
  );
}
