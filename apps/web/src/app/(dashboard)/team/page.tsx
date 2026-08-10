'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardEyebrow } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/layout/page-header';
import { toast } from '@/hooks/use-toast';
import { UserRole } from '@nexa/shared';
import { Mail, Clock, UserPlus, Shield, Trash2 } from 'lucide-react';

type Member = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: { firstName: string; lastName: string };
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Dueño',
  ADMIN: 'Administrador',
  MEMBER: 'Miembro',
  VIEWER: 'Espectador',
};

const ROLE_TONE: Record<string, 'mute' | 'cobalt' | 'naranja' | 'verde'> = {
  OWNER: 'naranja',
  ADMIN: 'cobalt',
  MEMBER: 'verde',
  VIEWER: 'mute',
};

export default function TeamPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState(UserRole.MEMBER);
  const [revoking, setRevoking] = useState<string | null>(null);

  const {
    data: members,
    isLoading: membersLoading,
    isError: membersError,
    error: membersErrorObj,
  } = useQuery<Member[]>({
    queryKey: ['organization-users'],
    queryFn: () => api.get('/organizations/users'),
  });

  const {
    data: invitations,
    isLoading: invitesLoading,
    isError: invitesError,
    error: invitesErrorObj,
  } = useQuery<Invitation[]>({
    queryKey: ['invitations'],
    queryFn: () => api.get('/invitations'),
  });

  const inviteMutation = useMutation({
    mutationFn: () => api.post('/invitations', { email: inviteEmail, role: inviteRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole(UserRole.MEMBER);
      toast({ title: 'Invitación enviada', variant: 'success' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/invitations/${id}`),
    onMutate: (id) => setRevoking(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast({ title: 'Invitación revocada', variant: 'success' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
    onSettled: () => setRevoking(null),
  });

  const canInvite = currentUser?.role === UserRole.OWNER || currentUser?.role === UserRole.ADMIN;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        eyebrow="Equipo"
        numeral={String(members?.length ?? 0).padStart(2, '0')}
        title="Personas"
        description="Quiénes operan el CRM. Quién puede editar, leer o mirar."
        actions={
          canInvite ? (
            <Button variant="ink" size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="mr-2 h-3.5 w-3.5" />
              Invitar miembro
            </Button>
          ) : undefined
        }
      />

      {canInvite && (
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Invitar miembro</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="invite-email" className="eyebrow">
                  Email
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role" className="eyebrow">
                  Rol
                </Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as UserRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UserRole.ADMIN}>Administrador</SelectItem>
                    <SelectItem value={UserRole.MEMBER}>Miembro</SelectItem>
                    <SelectItem value={UserRole.VIEWER}>Espectador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="ink"
                className="w-full"
                onClick={() => inviteMutation.mutate()}
                disabled={!inviteEmail || inviteMutation.isPending}
              >
                {inviteMutation.isPending ? 'Enviando…' : 'Enviar invitación'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Card>
        <CardEyebrow className="eyebrow flex items-center justify-between">
          <span>01 · Miembros</span>
          <Shield className="text-ink-3 h-3.5 w-3.5" strokeWidth={1.5} />
        </CardEyebrow>
        <CardContent className="pt-5">
          {membersError ? (
            <div className="text-alizarin flex h-32 items-center justify-center">
              Error: {membersErrorObj?.message || 'Error desconocido'}
            </div>
          ) : membersLoading ? (
            <div className="border-ink/14 divide-ink/10 divide-y border">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-receipt flex items-center gap-3 p-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ul className="border-ink/14 bg-paper-2 border">
              {members?.map((member) => {
                const tone = ROLE_TONE[member.role] ?? 'mute';
                const initials = `${member.firstName[0] ?? ''}${member.lastName[0] ?? ''}`;
                return (
                  <li
                    key={member.id}
                    className="bg-receipt border-ink/10 hover:bg-paper-2 fade-up flex items-center justify-between gap-3 border-b px-4 py-3 transition-colors last:border-b-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="numeral bg-ink text-paper inline-flex h-9 w-9 shrink-0 items-center justify-center text-[12px]">
                        {initials}
                      </span>
                      <div className="min-w-0">
                        <p className="font-display truncate text-[16px] leading-tight">
                          {member.firstName} {member.lastName}
                        </p>
                        <p className="eyebrow text-ink-3 truncate">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {!member.isActive && (
                        <span className="eyebrow text-ink-3 border-ink/14 border px-1.5 py-0.5">
                          Inactivo
                        </span>
                      )}
                      <span
                        className={`eyebrow border px-2 py-0.5 ${
                          tone === 'mute'
                            ? 'border-ink/22 text-ink-3'
                            : tone === 'cobalt'
                              ? 'border-cobalt text-cobalt'
                              : tone === 'naranja'
                                ? 'border-naranja text-naranja'
                                : 'border-verde text-verde'
                        }`}
                      >
                        {ROLE_LABELS[member.role] ?? member.role}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {invitesError && (
        <div className="text-alizarin flex h-32 items-center justify-center">
          Error: {invitesErrorObj?.message || 'Error desconocido'}
        </div>
      )}
      {canInvite && invitations && invitations.length > 0 && (
        <Card>
          <CardEyebrow className="eyebrow flex items-center justify-between">
            <span>
              02 · Invitaciones pendientes ·{' '}
              <span className="numeral text-naranja">
                {String(invitations.length).padStart(2, '0')}
              </span>
            </span>
            <Mail className="text-ink-3 h-3.5 w-3.5" strokeWidth={1.5} />
          </CardEyebrow>
          <CardContent className="pt-5">
            <ul className="border-ink/14 bg-paper-2 border">
              {invitations.map((inv) => {
                const tone = ROLE_TONE[inv.role] ?? 'mute';
                return (
                  <li
                    key={inv.id}
                    className="bg-receipt border-ink/10 fade-up flex items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="numeral bg-paper-2 border-ink/14 text-ink inline-flex h-9 w-9 shrink-0 items-center justify-center border text-[12px]">
                        <Mail className="h-4 w-4" strokeWidth={1.5} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm">{inv.email}</p>
                        <p className="eyebrow text-ink-3 mt-1 truncate">
                          Invitado por {inv.invitedBy.firstName} {inv.invitedBy.lastName}
                          <span
                            className={`ml-2 border px-1.5 py-0 ${
                              tone === 'mute'
                                ? 'border-ink/22 text-ink-3'
                                : tone === 'cobalt'
                                  ? 'border-cobalt text-cobalt'
                                  : tone === 'naranja'
                                    ? 'border-naranja text-naranja'
                                    : 'border-verde text-verde'
                            }`}
                          >
                            {ROLE_LABELS[inv.role] ?? inv.role}
                          </span>
                        </p>
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-ink-3 hover:text-alizarin"
                          disabled={revoking === inv.id}
                        >
                          {revoking === inv.id ? (
                            <Clock className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Revocar invitación?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => revokeMutation.mutate(inv.id)}>
                            Revocar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </li>
                );
              })}
              <li className="border-ink/10 bg-paper-2 text-ink-3 border-t px-4 py-2 text-[11px]">
                Las invitaciones expiran automáticamente.
              </li>
            </ul>
            {invitesLoading && <Separator className="bg-ink/14 mt-4" />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
