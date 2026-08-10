'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardEyebrow } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/use-permissions';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/layout/page-header';
import { Stamp } from '@/components/ui/stamp';
import { lookupStatus, TASK_STATUS_LIST } from '@/components/ui/status-stamps';
import { timeAgo } from '@/lib/utils';
import { useFormatCurrency } from '@/hooks/use-format-currency';
import {
  Mail,
  Phone,
  MapPin,
  Tag,
  Calendar,
  ArrowLeft,
  Pencil,
  Briefcase,
  ListTodo,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateClientSchema, type UpdateClientInput } from '@nexa/shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type ClientDetail = {
  id: string;
  companyName: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tags: string[];
  notes: string | null;
  createdAt: string;
  deals: Array<{
    id: string;
    title: string;
    value: number;
    stage: { name: string; color: string };
    assignee: { firstName: string; lastName: string } | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    assignee: { firstName: string; lastName: string } | null;
  }>;
  quotes: Array<{ id: string; number: string; total: number; status: string }>;
  activityLogs: Array<{
    id: string;
    type: string;
    description: string;
    createdAt: string;
    user: { firstName: string; lastName: string; avatarUrl: string | null };
  }>;
  _count: { deals: number; tasks: number; quotes: number };
};

export default function ClientDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const { canEdit } = usePermissions();

  const { data: client, isLoading } = useQuery<ClientDetail>({
    queryKey: ['client', id],
    queryFn: () => api.get(`/clients/${id}`),
    enabled: !!id,
  });
  const formatCurrency = useFormatCurrency();

  const updateMutation = useMutation({
    mutationFn: (body: UpdateClientInput) => api.patch(`/clients/${id}`, body),
    onSuccess: () => {
      toast({ title: 'Cliente actualizado', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['client', id] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setEditOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const editForm = useForm<UpdateClientInput>({
    resolver: zodResolver(updateClientSchema),
  });

  const openEdit = () => {
    if (!client) return;
    editForm.reset({
      companyName: client.companyName,
      contactName: client.contactName,
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      notes: client.notes || '',
      tags: client.tags,
    });
    setEditOpen(true);
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1280px] space-y-8">
        <Skeleton className="h-12 w-80" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="border-ink/14 space-y-px border lg:col-span-2">
            <Skeleton className="bg-receipt h-48" />
            <Skeleton className="bg-receipt h-48" />
          </div>
          <div className="border-ink/14 space-y-px border">
            <Skeleton className="bg-receipt h-32" />
            <Skeleton className="bg-receipt h-48" />
          </div>
        </div>
      </div>
    );
  }

  if (!client) return <p className="text-alizarin">Cliente no encontrado.</p>;

  const totalDealValue = client.deals.reduce((acc, d) => acc + Number(d.value), 0);
  const initials =
    client.companyName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '·';

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <div className="flex items-center gap-2">
        <Link href="/clients" className="text-ink-3 hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="eyebrow text-ink-3">Volver a clientes</span>
      </div>

      <div className="border-ink/22 flex items-end gap-5 border-b pb-6">
        <span className="numeral bg-ink text-paper inline-flex h-20 w-20 shrink-0 items-center justify-center text-[28px]">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-ink-3 mb-1">{client.contactName}</p>
          <h1 className="font-display text-[40px] leading-[1.04] tracking-[-0.025em]">
            {client.companyName}
          </h1>
        </div>
        {canEdit && (
          <Button variant="ink" size="sm" onClick={openEdit}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Editar
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardEyebrow className="eyebrow">01 · Información</CardEyebrow>
            <CardContent className="pt-5">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                {client.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="text-ink-3 h-4 w-4 shrink-0" strokeWidth={1.5} />
                    <dt className="sr-only">Email</dt>
                    <dd className="truncate">{client.email}</dd>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="text-ink-3 h-4 w-4 shrink-0" strokeWidth={1.5} />
                    <span>{client.phone}</span>
                  </div>
                )}
                {client.address && (
                  <div className="col-span-2 flex items-center gap-2">
                    <MapPin className="text-ink-3 h-4 w-4 shrink-0" strokeWidth={1.5} />
                    <span>{client.address}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Calendar className="text-ink-3 h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <span>
                    Cliente desde {new Date(client.createdAt).toLocaleDateString('es-AR')}
                  </span>
                </div>
                {client.tags.length > 0 && (
                  <div className="col-span-2 flex flex-wrap items-center gap-2">
                    <Tag className="text-ink-3 h-4 w-4 shrink-0" strokeWidth={1.5} />
                    {client.tags.map((tag) => (
                      <span
                        key={tag}
                        className="eyebrow text-ink-2 border-ink/14 border px-1.5 py-0.5"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </dl>
              {client.notes && (
                <div className="border-ink/14 mt-6 border-t pt-5">
                  <p className="eyebrow text-ink-3 mb-2">Notas</p>
                  <p className="whitespace-pre-wrap text-sm">{client.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardEyebrow className="eyebrow flex items-center justify-between">
              <span>
                02 · Oportunidades ·{' '}
                <span className="numeral text-naranja">
                  {String(client.deals.length).padStart(2, '0')}
                </span>
              </span>
              <Briefcase className="text-ink-3 h-3.5 w-3.5" strokeWidth={1.5} />
            </CardEyebrow>
            <CardContent className="pt-5">
              {client.deals.length === 0 ? (
                <p className="eyebrow text-ink-3">Sin oportunidades abiertas.</p>
              ) : (
                <ul className="divide-ink/10 divide-y">
                  {client.deals.map((deal) => (
                    <li key={deal.id} className="flex items-baseline justify-between py-3">
                      <div className="min-w-0 space-y-1">
                        <p className="font-display text-[17px] leading-tight">{deal.title}</p>
                        <p className="eyebrow text-ink-3">
                          <span
                            className="mr-1 inline-block h-2 w-2 align-middle"
                            style={{ backgroundColor: deal.stage.color }}
                          />
                          {deal.stage.name}
                          {deal.assignee && (
                            <>
                              {' '}
                              &middot; {deal.assignee.firstName} {deal.assignee.lastName}
                            </>
                          )}
                        </p>
                      </div>
                      <span className="numeral text-naranja tabular text-[17px]">
                        {formatCurrency(Number(deal.value))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardEyebrow className="eyebrow flex items-center justify-between">
              <span>03 · Actividad reciente</span>
              <Calendar className="text-ink-3 h-3.5 w-3.5" strokeWidth={1.5} />
            </CardEyebrow>
            <CardContent className="pt-5">
              {client.activityLogs.length === 0 ? (
                <p className="eyebrow text-ink-3">Sin actividad registrada.</p>
              ) : (
                <ul className="space-y-4">
                  {client.activityLogs.map((log) => (
                    <li key={log.id} className="flex items-start gap-3">
                      <span className="numeral bg-ink text-paper inline-flex h-7 w-7 shrink-0 items-center justify-center text-[11px]">
                        {log.user.firstName.charAt(0)}
                        {log.user.lastName.charAt(0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug">{log.description}</p>
                        <p className="eyebrow text-ink-3 mt-1">{timeAgo(log.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardEyebrow className="eyebrow">04 · Resumen</CardEyebrow>
            <CardContent className="space-y-3 pt-5">
              <div className="flex items-center justify-between">
                <span className="eyebrow text-ink-3">Oportunidades</span>
                <span className="numeral tabular text-[18px]">{client._count.deals}</span>
              </div>
              <Separator className="bg-ink/14" />
              <div className="flex items-center justify-between">
                <span className="eyebrow text-ink-3">Tareas</span>
                <span className="numeral tabular text-[18px]">{client._count.tasks}</span>
              </div>
              <Separator className="bg-ink/14" />
              <div className="flex items-center justify-between">
                <span className="eyebrow text-ink-3">Presupuestos</span>
                <span className="numeral tabular text-[18px]">{client._count.quotes}</span>
              </div>
              <Separator className="bg-ink/14" />
              <div className="flex items-baseline justify-between pt-1">
                <span className="eyebrow text-ink-3">Pipeline total</span>
                <span className="numeral text-naranja tabular text-[22px]">
                  {formatCurrency(totalDealValue)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardEyebrow className="eyebrow flex items-center justify-between">
              <span>05 · Tareas</span>
              <ListTodo className="text-ink-3 h-3.5 w-3.5" strokeWidth={1.5} />
            </CardEyebrow>
            <CardContent className="pt-5">
              {client.tasks.length === 0 ? (
                <p className="eyebrow text-ink-3">Sin tareas asociadas.</p>
              ) : (
                <ul className="space-y-3">
                  {client.tasks.map((task) => {
                    const s = lookupStatus(TASK_STATUS_LIST, task.status);
                    return (
                      <li key={task.id} className="flex items-start justify-between gap-3">
                        <span className="flex-1 text-sm leading-snug">{task.title}</span>
                        <Stamp tone={s.tone} size="sm" rotate={-1.5}>
                          {s.stamp}
                        </Stamp>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Editar cliente</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={editForm.handleSubmit((data) => updateMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label className="eyebrow">Empresa</Label>
              <Input {...editForm.register('companyName')} placeholder="Nombre de la empresa" />
              <p className="eyebrow text-alizarin">
                {editForm.formState.errors.companyName?.message}
              </p>
            </div>
            <div className="space-y-2">
              <Label className="eyebrow">Contacto</Label>
              <Input {...editForm.register('contactName')} placeholder="Nombre del contacto" />
              <p className="eyebrow text-alizarin">
                {editForm.formState.errors.contactName?.message}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="eyebrow">Email</Label>
                <Input {...editForm.register('email')} placeholder="Email" />
                <p className="eyebrow text-alizarin">{editForm.formState.errors.email?.message}</p>
              </div>
              <div className="space-y-2">
                <Label className="eyebrow">Teléfono</Label>
                <Input {...editForm.register('phone')} placeholder="Teléfono" />
                <p className="eyebrow text-alizarin">{editForm.formState.errors.phone?.message}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="eyebrow">Dirección</Label>
              <Input {...editForm.register('address')} placeholder="Dirección" />
              <p className="eyebrow text-alizarin">{editForm.formState.errors.address?.message}</p>
            </div>
            <div className="space-y-2">
              <Label className="eyebrow">Notas</Label>
              <Input {...editForm.register('notes')} placeholder="Notas…" />
              <p className="eyebrow text-alizarin">{editForm.formState.errors.notes?.message}</p>
            </div>
            <Button
              type="submit"
              variant="ink"
              className="w-full"
              disabled={updateMutation.isPending}
            >
              Guardar cambios
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
