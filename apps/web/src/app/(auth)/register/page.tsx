'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterInput } from '@nexa/shared';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell } from '@/components/auth/auth-shell';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    try {
      setError('');
      await registerUser(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    }
  };

  return (
    <AuthShell title="Crear cuenta" subtitle="Nexa CRM gratis para arrancar.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="border-alizarin/40 bg-alizarin/10 eyebrow text-alizarin border px-3 py-2">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="eyebrow">
              Nombre
            </Label>
            <Input id="firstName" placeholder="Juan" {...register('firstName')} />
            {errors.firstName && (
              <p className="eyebrow text-alizarin">{errors.firstName.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className="eyebrow">
              Apellido
            </Label>
            <Input id="lastName" placeholder="Pérez" {...register('lastName')} />
            {errors.lastName && <p className="eyebrow text-alizarin">{errors.lastName.message}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="eyebrow">
            Email
          </Label>
          <Input id="email" type="email" placeholder="tu@email.com" {...register('email')} />
          {errors.email && <p className="eyebrow text-alizarin">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="organizationName" className="eyebrow">
            Empresa
          </Label>
          <Input
            id="organizationName"
            placeholder="Mi Empresa S.A."
            {...register('organizationName')}
          />
          {errors.organizationName && (
            <p className="eyebrow text-alizarin">{errors.organizationName.message}</p>
          )}
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
              Creando cuenta…
            </>
          ) : (
            'Crear cuenta'
          )}
        </Button>
      </form>

      <p className="eyebrow text-ink-3 border-ink/14 mt-6 border-t pt-4 text-center">
        ¿Ya tenés cuenta?{' '}
        <Link href="/login" className="text-naranja hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </AuthShell>
  );
}
