'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardEyebrow, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/layout/page-header';
import { toast } from '@/hooks/use-toast';
import {
  Mail,
  Phone,
  Building2,
  Shield,
  Loader2,
  Pencil,
  X,
  Check,
  KeyRound,
  Hash,
} from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;

  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      await api.patch('/users/me', { firstName, lastName, phone: phone || undefined });
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      toast({ title: 'Perfil actualizado', variant: 'success' });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error desconocido';
      setError(message);
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setPhone(user.phone || '');
    setEditing(false);
    setError('');
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        eyebrow="Tu cuenta"
        numeral="01"
        title="Perfil"
        description="Tus datos. Cómo te llamás, cómo te contactamos, con quién trabajás."
        actions={
          !editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={saving}>
                <X className="mr-2 h-3.5 w-3.5" /> Cancelar
              </Button>
              <Button variant="ink" size="sm" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="mr-2 h-3.5 w-3.5" />
                )}
                Guardar
              </Button>
            </div>
          )
        }
      />

      <Card>
        <CardEyebrow className="eyebrow flex items-center justify-between">
          <span>01 · Identidad</span>
          <span className="numeral text-[10px] uppercase tracking-[0.18em]">{user.role}</span>
        </CardEyebrow>
        <CardTitle className="sr-only">Identidad</CardTitle>
        <CardContent className="space-y-6 pt-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.avatarUrl || ''} />
              <AvatarFallback className="numeral bg-ink text-paper text-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="font-display text-[22px] leading-tight">
                {user.firstName} {user.lastName}
              </h2>
              <p className="eyebrow text-ink-3 mt-1 truncate">{user.email}</p>
            </div>
          </div>

          <Separator className="bg-ink/14" />

          {error && (
            <div className="border-alizarin/40 bg-alizarin/10 eyebrow text-alizarin border px-3 py-2">
              {error}
            </div>
          )}

          <dl className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Mail className="text-ink-3 h-4 w-4 shrink-0" strokeWidth={1.5} />
              <dt className="sr-only">Email</dt>
              <dd className="truncate">{user.email}</dd>
            </div>
            {editing ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="eyebrow">
                    Nombre
                  </Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="eyebrow">
                    Apellido
                  </Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="eyebrow">
                    Teléfono
                  </Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+54 11 1234-5678"
                  />
                </div>
              </>
            ) : (
              user.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="text-ink-3 h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <span>{user.phone}</span>
                </div>
              )
            )}
            <div className="flex items-center gap-3">
              <Building2 className="text-ink-3 h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span>{user.organizationName}</span>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="text-ink-3 h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span>Rol · {user.role}</span>
            </div>
            <div className="flex items-center gap-3">
              <Hash className="text-ink-3 h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span className="font-mono text-xs">{user.id}</span>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardEyebrow className="eyebrow flex items-center justify-between">
          <span>02 · Contraseña</span>
          <KeyRound className="text-ink-3 h-3.5 w-3.5" strokeWidth={1.5} />
        </CardEyebrow>
        <CardTitle className="sr-only">Cambiar contraseña</CardTitle>
        <CardContent className="pt-5">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const currentPassword = formData.get('currentPassword') as string;
              const newPassword = formData.get('newPassword') as string;
              const confirmPassword = formData.get('confirmPassword') as string;

              if (newPassword !== confirmPassword) {
                toast({ title: 'Las contraseñas no coinciden', variant: 'destructive' });
                return;
              }
              if (newPassword.length < 8) {
                toast({ title: 'Mínimo 8 caracteres', variant: 'destructive' });
                return;
              }

              try {
                await api.patch('/users/me/password', { currentPassword, newPassword });
                toast({ title: 'Contraseña actualizada', variant: 'success' });
                (e.target as HTMLFormElement).reset();
              } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Error desconocido';
                toast({ title: 'Error', description: message, variant: 'destructive' });
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="eyebrow">
                Contraseña actual
              </Label>
              <Input id="currentPassword" name="currentPassword" type="password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="eyebrow">
                Nueva contraseña
              </Label>
              <Input id="newPassword" name="newPassword" type="password" required minLength={8} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="eyebrow">
                Confirmar contraseña
              </Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
              />
            </div>
            <Button type="submit" variant="ink" size="sm">
              Actualizar contraseña
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
