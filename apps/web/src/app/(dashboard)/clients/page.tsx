'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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

import { usePermissions } from '@/hooks/use-permissions';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Building2,
  Mail,
  Phone,
  Download,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClientSchema, type CreateClientInput } from '@nexa/shared';
import { Label } from '@/components/ui/label';

type ClientsResponse = {
  data: Array<{
    id: string;
    companyName: string;
    contactName: string;
    email: string | null;
    phone: string | null;
    tags: string[];
    createdAt: string;
    _count: { deals: number; tasks: number; quotes: number };
  }>;
  meta: { total: number; page: number; limit: number; totalPages: number };
};

export default function ClientsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const queryClient = useQueryClient();
  const { canCreate, canDelete } = usePermissions();

  const { data, isLoading, isError, error, refetch } = useQuery<ClientsResponse>({
    queryKey: ['clients', search, page],
    queryFn: () => api.get('/clients', { search, page: String(page), limit: '20' }),
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateClientInput) => api.post('/clients', body),
    onSuccess: () => {
      toast({ title: 'Cliente creado', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => {
      toast({ title: 'Cliente eliminado', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const form = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: { tags: [] },
  });

  const exportCSV = async () => {
    setExporting(true);
    try {
      const res = await api.get<ClientsResponse>('/clients', { limit: '10000' });
      const clients = res.data || [];
      const header = 'Empresa,Contacto,Email,Teléfono,Dirección,Notas,Tags';
      const rows = clients.map((c) =>
        [
          `"${(c.companyName || '').replace(/"/g, '""')}"`,
          `"${(c.contactName || '').replace(/"/g, '""')}"`,
          `"${(c.email || '').replace(/"/g, '""')}"`,
          `"${(c.phone || '').replace(/"/g, '""')}"`,
          `"${('address' in c ? (c as any).address || '' : '').replace(/"/g, '""')}"`,
          `"${('notes' in c ? (c as any).notes || '' : '').replace(/"/g, '""')}"`,
          `"${(c.tags || []).join('; ')}"`,
        ].join(','),
      );
      const csv = [header, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Exportación completada', variant: 'success' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al exportar';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      <PageHeader
        eyebrow="Cartera"
        numeral={String(data?.meta.total ?? 0).padStart(2, '0')}
        title="Clientes"
        description="Empresas y contactos con los que hacés negocio. Buscás por nombre, llamás por tag."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={exporting}>
              <Download className="mr-2 h-3.5 w-3.5" />
              {exporting ? 'Exportando…' : 'Exportar CSV'}
            </Button>
            {canCreate && (
              <Button variant="ink" size="sm" onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-3.5 w-3.5" />
                Nuevo cliente
              </Button>
            )}
          </>
        }
      />

      {canCreate && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Nuevo cliente</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label className="eyebrow">Empresa</Label>
                <Input {...form.register('companyName')} placeholder="Nombre de la empresa" />
                <p className="eyebrow text-alizarin">
                  {form.formState.errors.companyName?.message}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="eyebrow">Contacto</Label>
                <Input {...form.register('contactName')} placeholder="Nombre del contacto" />
                <p className="eyebrow text-alizarin">
                  {form.formState.errors.contactName?.message}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="eyebrow">Email</Label>
                  <Input {...form.register('email')} placeholder="Email" />
                  <p className="eyebrow text-alizarin">{form.formState.errors.email?.message}</p>
                </div>
                <div className="space-y-2">
                  <Label className="eyebrow">Teléfono</Label>
                  <Input {...form.register('phone')} placeholder="Teléfono" />
                  <p className="eyebrow text-alizarin">{form.formState.errors.phone?.message}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="eyebrow">Dirección</Label>
                <Input {...form.register('address')} placeholder="Dirección" />
                <p className="eyebrow text-alizarin">{form.formState.errors.address?.message}</p>
              </div>
              <div className="space-y-2">
                <Label className="eyebrow">Notas</Label>
                <Input {...form.register('notes')} placeholder="Notas…" />
                <p className="eyebrow text-alizarin">{form.formState.errors.notes?.message}</p>
              </div>
              <Button
                type="submit"
                variant="ink"
                className="w-full"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? 'Creando…' : 'Crear cliente'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <div className="relative max-w-md">
        <Search className="text-ink-3 pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Buscar por empresa o contacto…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="pl-10"
        />
      </div>

      {isError ? (
        <div className="text-alizarin flex h-48 flex-col items-center justify-center gap-3">
          <p>No pudimos cargar tus clientes. {error?.message || 'Error desconocido'}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : isLoading ? (
        <div className="border-ink/14 grid gap-px border md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-receipt space-y-3 p-5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      ) : data?.data?.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No hay clientes"
          description={
            search
              ? `Nada que coincida con "${search}". Probá con otro término.`
              : 'Sumá tu primer cliente para empezar a operar.'
          }
          action={
            canCreate && !search ? (
              <Button onClick={() => setOpen(true)} variant="ink">
                <Plus className="mr-2 h-3.5 w-3.5" />
                Nuevo cliente
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="border-ink/14 grid gap-px border md:grid-cols-2 lg:grid-cols-3">
          {data?.data.map((client) => {
            const initials =
              client.companyName
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase() ?? '')
                .join('') || '·';
            return (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="bg-receipt hover:bg-paper-2 fade-up group relative p-5 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="numeral bg-ink text-paper inline-flex h-10 w-10 shrink-0 items-center justify-center text-sm">
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-display truncate text-[18px] leading-tight">
                        {client.companyName}
                      </h3>
                      <p className="text-ink-3 truncate text-xs">{client.contactName}</p>
                    </div>
                  </div>
                  {canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-ink-3 hover:text-alizarin px-2 text-[11px] opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminarán todos los datos
                            relacionados.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(client.id)}>
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
                <div className="text-ink-3 mt-4 space-y-1 text-xs">
                  {client.email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="h-3 w-3 shrink-0" strokeWidth={1.5} />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3 shrink-0" strokeWidth={1.5} />
                      {client.phone}
                    </div>
                  )}
                </div>
                <div className="border-ink/14 text-ink-3 tabular mt-4 flex items-center gap-3 border-t pt-4 text-[11px]">
                  <span>
                    <span className="text-ink font-medium">{client._count.deals}</span> deals
                  </span>
                  <span className="text-ink-3/40">·</span>
                  <span>
                    <span className="text-ink font-medium">{client._count.tasks}</span> tareas
                  </span>
                  <span className="text-ink-3/40">·</span>
                  <span>
                    <span className="text-ink font-medium">{client._count.quotes}</span>{' '}
                    presupuestos
                  </span>
                </div>
                {client.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {client.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px]">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {data?.meta && data.meta.totalPages > 1 && (
        <nav className="flex items-center justify-center gap-3 pt-2" aria-label="Paginación">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
          </Button>
          <span className="eyebrow text-ink-3">
            Página {String(page).padStart(2, '0')} / {String(data.meta.totalPages).padStart(2, '0')}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </nav>
      )}
    </div>
  );
}
