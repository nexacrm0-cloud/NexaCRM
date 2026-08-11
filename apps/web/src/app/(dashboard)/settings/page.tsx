'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';
import {
  Building2,
  DollarSign,
  Clock,
  Calendar,
  Loader2,
  Pencil,
  X,
  Check,
  Key,
  Trash2,
  Copy,
  Plus,
  ShieldCheck,
  QrCode,
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

type SettingsData = {
  organization: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    plan: string;
    currency: string;
    locale: string;
  };
  defaults: { taxRate: number; timezone: string; dateFormat: string };
};

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'OWNER';

  const { data, isLoading, isError, error } = useQuery<SettingsData>({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings'),
  });

  const [editing, setEditing] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [currency, setCurrency] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [timezone, setTimezone] = useState('');
  const [dateFormat, setDateFormat] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // 2FA state
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [disableConfirm, setDisableConfirm] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [disableError, setDisableError] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch('/settings', body),
    onSuccess: () => {
      toast({ title: 'Configuración actualizada', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setEditing(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const startEditing = () => {
    setOrgName(data?.organization.name || '');
    setCurrency(data?.organization.currency || 'ARS');
    setTaxRate(String(data?.defaults.taxRate ?? ''));
    setTimezone(data?.defaults.timezone || '');
    setDateFormat(data?.defaults.dateFormat || '');
    setEditing(true);
  };

  type ApiKeyItem = {
    id: string;
    name: string;
    prefix: string;
    isActive: boolean;
    lastUsedAt: string | null;
    expiresAt: string | null;
    createdAt: string;
  };

  const { data: apiKeysData, isLoading: apiKeysLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get<{ success: boolean; data: ApiKeyItem[] }>('/api-keys'),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyExpiry, setNewKeyExpiry] = useState('');
  const [createdKey, setCreatedKey] = useState<{ name: string; rawKey: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const createKeyMutation = useMutation({
    mutationFn: (body: { name: string; expiresInDays?: number }) =>
      api.post<{
        success: boolean;
        data: { id: string; name: string; rawKey: string; prefix: string; createdAt: string };
      }>('/api-keys', body),
    onSuccess: (res) => {
      setCreatedKey({ name: res.data.name, rawKey: res.data.rawKey });
      setNewKeyName('');
      setNewKeyExpiry('');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete<{ success: boolean; data: { message: string } }>(`/api-keys/${id}`),
    onSuccess: () => {
      toast({ title: 'API Key eliminada', variant: 'success' });
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const handleCreate = () => {
    if (!newKeyName.trim()) return;
    const expiresInDays = newKeyExpiry ? parseInt(newKeyExpiry, 10) : undefined;
    createKeyMutation.mutate({ name: newKeyName.trim(), expiresInDays });
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: 'Copiado al portapapeles', variant: 'success' });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        eyebrow="Ajustes"
        numeral="01"
        title="Configuración"
        description="Tu organización, parámetros regionales y accesos. Lo que define cómo opera todo lo demás."
        actions={
          isAdmin && !editing ? (
            <Button variant="outline" size="sm" onClick={startEditing}>
              <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
            </Button>
          ) : editing ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(false)}
                disabled={updateMutation.isPending}
              >
                <X className="mr-2 h-3.5 w-3.5" /> Cancelar
              </Button>
              <Button
                variant="ink"
                size="sm"
                onClick={() =>
                  updateMutation.mutate({
                    name: orgName,
                    currency,
                    taxRate: taxRate ? Number(taxRate) : undefined,
                    timezone,
                    dateFormat,
                  })
                }
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="mr-2 h-3.5 w-3.5" />
                )}
                Guardar
              </Button>
            </div>
          ) : undefined
        }
      />

      {isError ? (
        <div className="text-destructive flex h-48 items-center justify-center">
          Error al cargar configuración: {error?.message || 'Error desconocido'}
        </div>
      ) : isLoading ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="text-ink-3 h-4 w-4" strokeWidth={1.6} />
                Organización
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data?.organization.logo && (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={data.organization.logo}
                    alt="Logo"
                    className="border-ink/22 h-12 w-12 border object-contain"
                  />
                  {editing && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[11px]"
                      onClick={async () => {
                        try {
                          await updateMutation.mutateAsync({ logo: '' });
                          queryClient.invalidateQueries({ queryKey: ['settings'] });
                          toast({ title: 'Logo eliminado', variant: 'success' });
                        } catch {
                          /* handled by mutation */
                        }
                      }}
                    >
                      Eliminar logo
                    </Button>
                  )}
                </div>
              )}
              {editing && (
                <div className="space-y-2">
                  <Label htmlFor="orgName" className="eyebrow">
                    Nombre
                  </Label>
                  <Input
                    id="orgName"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                  />
                </div>
              )}
              {editing && !data?.organization.logo && (
                <div className="space-y-2">
                  <Label className="eyebrow">Logo</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) {
                          toast({ title: 'Máximo 2MB', variant: 'destructive' });
                          return;
                        }
                        setUploadingLogo(true);
                        try {
                          const formData = new FormData();
                          formData.append('file', file);
                          const res = await api.post<{ url: string }>('/uploads/logo', formData);
                          await updateMutation.mutateAsync({ logo: res.url });
                          queryClient.invalidateQueries({ queryKey: ['settings'] });
                          toast({ title: 'Logo actualizado', variant: 'success' });
                        } catch (err: unknown) {
                          const msg = err instanceof Error ? err.message : 'Error al subir';
                          toast({ title: 'Error', description: msg, variant: 'destructive' });
                        } finally {
                          setUploadingLogo(false);
                        }
                      }}
                      disabled={uploadingLogo}
                    />
                    {uploadingLogo && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
                  </div>
                </div>
              )}
              {!editing && (
                <div className="flex justify-between text-sm">
                  <span className="eyebrow text-ink-3">Nombre</span>
                  <span className="text-ink font-medium">{data?.organization.name}</span>
                </div>
              )}
              <Separator className="bg-ink/14" />
              <div className="flex justify-between text-sm">
                <span className="eyebrow text-ink-3">Slug</span>
                <span className="text-ink font-mono">{data?.organization.slug}</span>
              </div>
              <Separator className="bg-ink/14" />
              <div className="flex items-center justify-between text-sm">
                <span className="eyebrow text-ink-3">Plan</span>
                <span className="eyebrow border-naranja text-naranja border px-2 py-0.5">
                  {data?.organization.plan}
                </span>
              </div>
              <Separator className="bg-ink/14" />
              <div className="flex items-center justify-between text-sm">
                <span className="eyebrow text-ink-3">Moneda</span>
                {editing ? (
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="w-[220px]">
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
                ) : (
                  <span className="text-ink font-medium">
                    {(() => {
                      const cur = CURRENCIES.find((c) => c.code === data?.organization.currency);
                      return cur
                        ? `${cur.symbol} ${cur.label}`
                        : (data?.organization.currency ?? 'ARS');
                    })()}
                  </span>
                )}
              </div>
              {updateMutation.isError && (
                <div className="border-alizarin/40 bg-alizarin/10 eyebrow text-alizarin border px-3 py-2">
                  Error al guardar la configuración
                </div>
              )}
            </CardContent>
          </Card>

          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Key className="text-ink-3 h-4 w-4" strokeWidth={1.6} />
                  API Keys
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {apiKeysLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ) : (
                  <>
                    {!apiKeysData?.data || apiKeysData.data.length === 0 ? (
                      <p className="eyebrow text-ink-3">No hay API Keys configuradas.</p>
                    ) : (
                      <ul className="border-ink/14 divide-ink/10 divide-y border">
                        {apiKeysData.data.map((key) => (
                          <li
                            key={key.id}
                            className="bg-receipt flex items-center justify-between px-4 py-3"
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-display text-[16px] leading-tight">
                                  {key.name}
                                </span>
                                <span
                                  className={`eyebrow border px-1.5 py-0.5 ${
                                    key.isActive
                                      ? 'border-verde text-verde'
                                      : 'border-ink/22 text-ink-3'
                                  }`}
                                >
                                  {key.isActive ? 'ACTIVA' : 'INACTIVA'}
                                </span>
                              </div>
                              <div className="eyebrow text-ink-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="font-mono">{key.prefix}</span>
                                {key.expiresAt && (
                                  <span>
                                    Expira · {new Date(key.expiresAt).toLocaleDateString()}
                                  </span>
                                )}
                                {key.lastUsedAt && (
                                  <span>
                                    Último uso · {new Date(key.lastUsedAt).toLocaleDateString()}
                                  </span>
                                )}
                                <span>Creada · {new Date(key.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <AlertDialog
                              open={deleteId === key.id}
                              onOpenChange={(open) => {
                                if (!open) setDeleteId(null);
                              }}
                            >
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-ink-3 hover:text-alizarin text-[11px]"
                                  onClick={() => setDeleteId(key.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Eliminar API Key</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    ¿Eliminar <strong>{key.name}</strong>? Esta acción no se puede
                                    deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setDeleteId(null)}>
                                    Cancelar
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteKeyMutation.mutate(key.id)}
                                    disabled={deleteKeyMutation.isPending}
                                  >
                                    {deleteKeyMutation.isPending ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : null}
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </li>
                        ))}
                      </ul>
                    )}

                    {isAdmin && (
                      <Dialog
                        open={createOpen}
                        onOpenChange={(open) => {
                          setCreateOpen(open);
                          if (!open) setCreatedKey(null);
                        }}
                      >
                        <Button variant="ink" size="sm" onClick={() => setCreateOpen(true)}>
                          <Plus className="mr-2 h-3.5 w-3.5" /> Crear API Key
                        </Button>
                        <DialogContent>
                          {createdKey ? (
                            <>
                              <DialogHeader>
                                <DialogTitle className="font-display">API Key creada</DialogTitle>
                                <DialogDescription>
                                  Copia esta clave ahora. No vas a volver a verla.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-3">
                                <div>
                                  <Label className="eyebrow">Nombre</Label>
                                  <Input value={createdKey.name} readOnly />
                                </div>
                                <div>
                                  <Label className="eyebrow">API Key</Label>
                                  <div className="flex gap-2">
                                    <Input
                                      value={createdKey.rawKey}
                                      readOnly
                                      className="font-mono text-xs"
                                    />
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => copyToClipboard(createdKey.rawKey)}
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  variant="ink"
                                  onClick={() => {
                                    setCreateOpen(false);
                                    setCreatedKey(null);
                                  }}
                                >
                                  Cerrar
                                </Button>
                              </DialogFooter>
                            </>
                          ) : (
                            <>
                              <DialogHeader>
                                <DialogTitle className="font-display">Crear API Key</DialogTitle>
                                <DialogDescription>
                                  Las API Keys permiten integración con servicios externos.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor="keyName" className="eyebrow">
                                    Nombre
                                  </Label>
                                  <Input
                                    id="keyName"
                                    value={newKeyName}
                                    onChange={(e) => setNewKeyName(e.target.value)}
                                    placeholder="Ej: Integración Slack"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="keyExpiry" className="eyebrow">
                                    Expiración (días, opcional)
                                  </Label>
                                  <Input
                                    id="keyExpiry"
                                    type="number"
                                    min="1"
                                    value={newKeyExpiry}
                                    onChange={(e) => setNewKeyExpiry(e.target.value)}
                                    placeholder="Dejar vacío para que no expire"
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                                  Cancelar
                                </Button>
                                <Button
                                  variant="ink"
                                  onClick={handleCreate}
                                  disabled={!newKeyName.trim() || createKeyMutation.isPending}
                                >
                                  {createKeyMutation.isPending ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : null}
                                  Crear
                                </Button>
                              </DialogFooter>
                            </>
                          )}
                        </DialogContent>
                      </Dialog>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="text-ink-3 h-4 w-4" strokeWidth={1.6} />
                Autenticación en dos pasos (2FA)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {user?.isTwoFactorEnabled ? (
                <>
                  <div className="eyebrow text-verde border-verde/40 bg-verde/5 flex items-center gap-2 border px-3 py-2">
                    <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.7} />
                    2FA habilitado
                  </div>
                  {!disableConfirm ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDisableConfirm(true)}
                      className="text-alizarin border-alizarin/40 text-[11px]"
                    >
                      Deshabilitar 2FA
                    </Button>
                  ) : (
                    <div className="border-ink/22 space-y-3 border px-4 py-3">
                      <p className="eyebrow text-ink-3">
                        Confirmá con tu app autenticadora para deshabilitar.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="000000"
                          maxLength={6}
                          className="tabular text-center font-mono tracking-[0.4em]"
                          value={disableCode}
                          onChange={(e) =>
                            setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                          }
                        />
                        <Button
                          variant="ink"
                          size="sm"
                          className="text-[11px]"
                          disabled={disableLoading || disableCode.length !== 6}
                          onClick={async () => {
                            setDisableLoading(true);
                            setDisableError('');
                            try {
                              await api.post('/auth/2fa/disable', { token: disableCode });
                              setDisableConfirm(false);
                              setDisableCode('');
                              setQrCodeData(null);
                              window.location.reload();
                            } catch (e: unknown) {
                              setDisableError(e instanceof Error ? e.message : 'Error');
                            } finally {
                              setDisableLoading(false);
                            }
                          }}
                        >
                          {disableLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Confirmar'
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[11px]"
                          onClick={() => {
                            setDisableConfirm(false);
                            setDisableCode('');
                            setDisableError('');
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                      {disableError && <p className="eyebrow text-alizarin">{disableError}</p>}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {!showTwoFactor ? (
                    <div className="space-y-3">
                      <p className="text-ink-3 text-sm">
                        Sumá una capa de seguridad a tu cuenta con autenticación en dos pasos.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[11px]"
                        onClick={async () => {
                          setTwoFactorLoading(true);
                          try {
                            const res = await api.post<{
                              success: boolean;
                              data: { qrCode: string };
                            }>('/auth/2fa/setup');
                            setQrCodeData(res.data.qrCode);
                            setShowTwoFactor(true);
                          } catch (e: unknown) {
                            setTwoFactorError(e instanceof Error ? e.message : 'Error');
                          } finally {
                            setTwoFactorLoading(false);
                          }
                        }}
                        disabled={twoFactorLoading}
                      >
                        {twoFactorLoading ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <QrCode className="mr-2 h-3.5 w-3.5" />
                        )}
                        Configurar 2FA
                      </Button>
                      {twoFactorError && <p className="eyebrow text-alizarin">{twoFactorError}</p>}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {qrCodeData && (
                        <div className="bg-paper border-ink/22 flex flex-col items-center gap-2 border p-4">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={qrCodeData} alt="QR Code" className="h-48 w-48" />
                          <p className="eyebrow text-ink-3">
                            Escaneá con tu app (Google Authenticator, Authy, etc.)
                          </p>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="twoFactorCode" className="eyebrow">
                          Código de verificación
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            id="twoFactorCode"
                            placeholder="000000"
                            maxLength={6}
                            className="tabular text-center font-mono tracking-[0.4em]"
                            value={twoFactorCode}
                            onChange={(e) =>
                              setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                            }
                          />
                          <Button
                            disabled={twoFactorCode.length !== 6}
                            onClick={async () => {
                              setTwoFactorLoading(true);
                              setTwoFactorError('');
                              try {
                                await api.post('/auth/2fa/verify', { token: twoFactorCode });
                                setShowTwoFactor(false);
                                setTwoFactorCode('');
                                setQrCodeData(null);
                                window.location.reload();
                              } catch (e: unknown) {
                                setTwoFactorError(e instanceof Error ? e.message : 'Error');
                              } finally {
                                setTwoFactorLoading(false);
                              }
                            }}
                          >
                            {twoFactorLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Verificar'
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setShowTwoFactor(false);
                              setQrCodeData(null);
                              setTwoFactorCode('');
                              setTwoFactorError('');
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                        {twoFactorError && (
                          <p className="text-destructive text-xs">{twoFactorError}</p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Subscription Card */}
      <SubscriptionCard />
    </div>
  );
}

function SubscriptionCard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const router = useRouter();

  const { data: planData, isLoading } = useQuery({
    queryKey: ['current-plan'],
    queryFn: () =>
      api.get<{ currentPlan: { id: string; name: string; price: number; priceArs?: number } }>(
        '/subscriptions/current',
      ),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const plan = planData?.currentPlan;
  const planBorder: Record<string, string> = {
    free: 'border-slate-500',
    starter: 'border-blue-500',
    pro: 'border-purple-500',
    enterprise: 'border-amber-500',
  };
  const planText: Record<string, string> = {
    free: 'text-slate-500',
    starter: 'text-blue-500',
    pro: 'text-purple-500',
    enterprise: 'text-amber-500',
  };
  const borderColor = planBorder[plan?.id ?? 'free'] ?? 'border-slate-500';
  const textColor = planText[plan?.id ?? 'free'] ?? 'text-slate-500';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" /> Plan Actual
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <Badge variant="outline" className={`${borderColor} ${textColor}`}>
              {plan?.name ?? 'Básico'}
            </Badge>
            <p className="text-muted-foreground mt-1 text-sm">
              {plan?.price === 0
                ? 'Gratis'
                : plan?.priceArs
                  ? `${new Intl.NumberFormat('es-AR', {
                      style: 'currency',
                      currency: 'ARS',
                      maximumFractionDigits: 0,
                    }).format(plan.priceArs)}/mes`
                  : `$${plan?.price}/mes`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push('/pricing')}>
            {plan?.id === 'free' ? 'Upgrade' : 'Cambiar plan'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
