'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardEyebrow } from '@/components/ui/card';
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
import { useFormatCurrency } from '@/hooks/use-format-currency';
import { usePermissions } from '@/hooks/use-permissions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Search,
  Trash2,
  Edit,
  Package,
  DollarSign,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Sliders,
} from 'lucide-react';
import { Stamp } from '@/components/ui/stamp';
import { StockAdjustDialog } from '@/components/inventory/stock-adjust-dialog';

const createProductSchema = z.object({
  sku: z.string().min(1, 'SKU requerido'),
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional(),
  price: z.number().min(0, 'Precio debe ser >= 0'),
  cost: z.number().min(0, 'Costo debe ser >= 0').optional(),
  unit: z.string().optional(),
  trackStock: z.boolean().default(true),
  stock: z.number().min(0).default(0),
  minStock: z.number().min(0).optional(),
  maxStock: z.number().min(0).optional(),
  categoryId: z.string().optional(),
  isActive: z.boolean().default(true),
  variants: z
    .array(
      z.object({
        sku: z.string().optional(),
        name: z.string().optional(),
        attributes: z.record(z.string()).optional(),
        price: z.number().min(0).optional(),
        stock: z.number().min(0).default(0),
        minStock: z.number().min(0).optional(),
        maxStock: z.number().min(0).optional(),
      }),
    )
    .optional(),
});

const updateProductSchema = createProductSchema.partial();

type CreateProductInput = z.infer<typeof createProductSchema>;
type UpdateProductInput = z.infer<typeof updateProductSchema>;

type Product = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  cost: number;
  unit: string | null;
  trackStock: boolean;
  stock: number;
  minStock: number | null;
  maxStock: number | null;
  categoryId: string | null;
  isActive: boolean;
  category: { id: string; name: string; color: string } | null;
  variants: Array<{
    id: string;
    name: string | null;
    sku: string | null;
    attributes: Record<string, string> | null;
    price: number | null;
    stock: number;
    reservedStock: number;
    minStock: number | null;
    maxStock: number | null;
    isActive: boolean;
  }>;
};

type ProductsResponse = {
  data: Product[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

type DashboardData = {
  summary: {
    totalProducts: number;
    activeProducts: number;
    trackedProducts: number;
    unitsOnHand: number;
    sinStock: number;
    lowStock: number;
    inventoryValue: number;
    potentialRevenue: number;
  };
  lowStock: Array<{
    id: string;
    sku: string;
    name: string;
    stock: number;
    minStock: number;
    deficit: number;
  }>;
  topMovers: Array<{ id: string; sku: string; name: string; movedQuantity: number }>;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
};

function InventoryDashboard({
  dashboard,
  formatCurrency,
}: {
  dashboard: DashboardData;
  formatCurrency: (n: number) => string;
}) {
  const { summary, lowStock, topMovers } = dashboard;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Card className="p-4">
        <CardEyebrow>Valor en stock (costo)</CardEyebrow>
        <p className="font-fraunces text-ink tabular mt-1 text-[28px] leading-none">
          {formatCurrency(summary.inventoryValue)}
        </p>
        <p className="eyebrow text-ink-3 mt-2">
          Revenue potencial {formatCurrency(summary.potentialRevenue)}
        </p>
      </Card>
      <Card className="p-4">
        <CardEyebrow>Unidades en mano</CardEyebrow>
        <p className="font-fraunces text-ink tabular mt-1 text-[28px] leading-none">
          {summary.unitsOnHand}
        </p>
        <p className="eyebrow text-ink-3 mt-2">
          {summary.trackedProducts} trackeado{summary.trackedProducts === 1 ? '' : 's'}
          {summary.sinStock > 0 && ` · ${summary.sinStock} sin stock`}
        </p>
      </Card>
      <Card className="p-4">
        <CardEyebrow>Productos</CardEyebrow>
        <p className="font-fraunces text-ink tabular mt-1 text-[28px] leading-none">
          {summary.totalProducts}
        </p>
        <p className="eyebrow text-ink-3 mt-2">
          {summary.activeProducts} activo{summary.activeProducts === 1 ? '' : 's'}
        </p>
      </Card>
      <Card className="p-4">
        <CardEyebrow>Alertas de stock</CardEyebrow>
        <p
          className={`font-fraunces tabular mt-1 text-[28px] leading-none ${
            summary.lowStock > 0 ? 'text-alizarin' : 'text-verde'
          }`}
        >
          {summary.lowStock}
        </p>
        <p className="eyebrow text-ink-3 mt-2">por debajo del mínimo</p>
      </Card>

      {(lowStock.length > 0 || topMovers.length > 0) && (
        <div className="grid gap-3 md:col-span-2 md:grid-cols-2 xl:col-span-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Stock bajo (a reponer)</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {lowStock.length === 0 ? (
                <p className="text-muted-foreground eyebrow text-sm">Todo en orden · 0 alertas</p>
              ) : (
                <table className="tabular w-full text-sm">
                  <tbody>
                    {lowStock.map((p) => (
                      <tr key={p.id} className="border-ink/8 border-t first:border-t-0">
                        <td className="max-w-[260px] truncate py-2 pr-2">{p.name}</td>
                        <td className="text-ink-3 px-2 py-2 font-mono text-xs">{p.sku}</td>
                        <td className="px-2 py-2 text-right">
                          <span className="text-ink-3">{p.stock}</span>
                          <span className="text-ink-3 mx-1">/</span>
                          <span className="font-medium">{p.minStock}</span>
                        </td>
                        <td className="text-alizarin px-2 py-2 text-right font-medium">
                          −{p.deficit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Top movers (últimos 30 días)</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {topMovers.length === 0 ? (
                <p className="text-muted-foreground eyebrow text-sm">
                  Sin movimientos de salida aún
                </p>
              ) : (
                <ol className="space-y-2">
                  {topMovers.map((p, i) => (
                    <li key={p.id} className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="numeral bg-ink text-paper tabular inline-flex h-6 w-6 shrink-0 items-center justify-center text-[11px]">
                          {i + 1}
                        </span>
                        <span className="truncate text-sm">{p.name}</span>
                      </div>
                      <span className="font-fraunces tabular text-lg">{p.movedQuantity}</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function InventoryPage() {
  const [open, setOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'lowStock'>('all');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const formatCurrency = useFormatCurrency();
  const { canCreate, canEdit, canDelete } = usePermissions();

  // Read categoryId from URL (?categoryId=xxx) so the sidebar can deep-link categories.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setCategoryId(params.get('categoryId'));
  }, []);

  const { data, isLoading, isError, error, refetch } = useQuery<ProductsResponse>({
    queryKey: ['products', page, filterStatus, search, categoryId],
    queryFn: () =>
      api.get('/inventory/products', {
        page: String(page),
        limit: '20',
        status: filterStatus === 'all' ? undefined : filterStatus,
        search: search || undefined,
        categoryId: categoryId || undefined,
      }),
    enabled: categoryId !== undefined, // avoids SSR hydration mismatch on first render
  });

  const { data: categories } = useQuery<{ data: Category[] }>({
    queryKey: ['categories'],
    queryFn: () => api.get('/inventory/products/categories'),
  });

  const { data: dashboard } = useQuery<DashboardData>({
    queryKey: ['inventory-dashboard'],
    queryFn: () => api.get<DashboardData>('/inventory/products/dashboard'),
    refetchInterval: 60_000,
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateProductInput) => api.post('/inventory/products', body),
    onSuccess: () => {
      toast({ title: 'Producto creado', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-dashboard'] });
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateProductInput }) =>
      api.patch(`/inventory/products/${id}`, body),
    onSuccess: () => {
      toast({ title: 'Producto actualizado', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-dashboard'] });
      setEditingProductId(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/products/${id}`),
    onSuccess: () => {
      toast({ title: 'Producto eliminado', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-dashboard'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const form = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      trackStock: true,
      stock: 0,
      isActive: true,
      variants: [],
    },
  });

  const editForm = useForm<UpdateProductInput>({
    resolver: zodResolver(updateProductSchema),
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'variants' });

  const products = data?.data ?? [];
  const meta = data?.meta;

  const handleCreateSubmit = (values: CreateProductInput) => {
    createMutation.mutate(values);
  };

  const handleEditSubmit = (values: UpdateProductInput) => {
    if (editingProductId) {
      updateMutation.mutate({ id: editingProductId, body: values });
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const openEdit = (product: Product) => {
    editForm.reset({
      sku: product.sku,
      name: product.name,
      description: product.description ?? '',
      price: product.price,
      cost: product.cost,
      unit: product.unit ?? '',
      trackStock: product.trackStock,
      stock: product.stock,
      minStock: product.minStock ?? undefined,
      maxStock: product.maxStock ?? undefined,
      categoryId: product.categoryId ?? undefined,
      isActive: product.isActive,
    });
    setEditingProductId(product.id);
  };

  const getStockStatus = (product: Product) => {
    if (!product.trackStock) return { label: 'Sin seguimiento', variant: 'secondary' as const };
    if (product.minStock !== null && product.stock <= product.minStock)
      return { label: 'Stock bajo', variant: 'destructive' as const };
    if (product.maxStock !== null && product.stock >= product.maxStock)
      return { label: 'Stock alto', variant: 'warning' as const };
    return { label: 'OK', variant: 'default' as const };
  };

  if (isError) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">Error cargando productos: {error?.message}</p>
          <Button onClick={() => refetch()} className="mt-2" variant="outline">
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        eyebrow="Stock"
        title="Inventario"
        description="Gestiona productos, variantes y stock"
        actions={
          canCreate && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo producto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Crear producto</DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(handleCreateSubmit)} className="space-y-4 p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="sku">SKU *</Label>
                      <Input id="sku" {...form.register('sku')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre *</Label>
                      <Input id="name" {...form.register('name')} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="description">Descripción</Label>
                      <Input id="description" {...form.register('description')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="price">Precio *</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        min="0"
                        {...form.register('price', { valueAsNumber: true })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cost">Costo</Label>
                      <Input
                        id="cost"
                        type="number"
                        step="0.01"
                        min="0"
                        {...form.register('cost', { valueAsNumber: true })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unit">Unidad</Label>
                      <Input id="unit" {...form.register('unit')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="categoryId">Categoría</Label>
                      <Select
                        onValueChange={(value) => form.setValue('categoryId', value || undefined)}
                        defaultValue={form.watch('categoryId') || ''}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Sin categoría</SelectItem>
                          {categories?.data?.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stock">Stock inicial</Label>
                      <Input
                        id="stock"
                        type="number"
                        min="0"
                        step="1"
                        {...form.register('stock', { valueAsNumber: true })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="minStock">Stock mínimo</Label>
                      <Input
                        id="minStock"
                        type="number"
                        min="0"
                        step="1"
                        {...form.register('minStock', { valueAsNumber: true })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxStock">Stock máximo</Label>
                      <Input
                        id="maxStock"
                        type="number"
                        min="0"
                        step="1"
                        {...form.register('maxStock', { valueAsNumber: true })}
                      />
                    </div>
                    <div className="flex items-end space-y-2">
                      <Label htmlFor="trackStock">Seguir stock</Label>
                      <Input
                        id="trackStock"
                        type="checkbox"
                        {...form.register('trackStock')}
                        className="h-4 w-4"
                      />
                    </div>
                    <div className="flex items-end space-y-2">
                      <Label htmlFor="isActive">Activo</Label>
                      <Input
                        id="isActive"
                        type="checkbox"
                        {...form.register('isActive')}
                        className="h-4 w-4"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? 'Creando...' : 'Crear producto'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Buscar productos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={filterStatus}
          onValueChange={(value) => setFilterStatus(value as 'all' | 'active' | 'lowStock')}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="lowStock">Stock bajo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {dashboard && dashboard.summary.totalProducts > 0 && (
        <InventoryDashboard dashboard={dashboard} formatCurrency={formatCurrency} />
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="mb-2 h-8 w-3/4" />
              <Skeleton className="mb-4 h-4 w-1/2" />
              <Skeleton className="mb-2 h-4 w-1/4" />
              <Skeleton className="h-4 w-1/3" />
            </Card>
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          title="No hay productos"
          description="Crea tu primer producto para empezar a gestionar el inventario"
          action={
            canCreate && (
              <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Crear producto
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => {
              const status = getStockStatus(product);
              return (
                <Card key={product.id} className="flex flex-col p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="truncate">{product.name}</CardTitle>
                        {product.category && (
                          <Stamp color={product.category.color || 'default'} className="text-xs">
                            {product.category.name}
                          </Stamp>
                        )}
                      </div>
                      <CardEyebrow className="mt-1 text-xs">{product.sku}</CardEyebrow>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>

                  <div className="mb-3 flex items-center justify-between">
                    <div className="font-fraunces text-xl font-bold">
                      {formatCurrency(product.price)}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {product.trackStock ? (
                        <>
                          <Package className="mr-1 inline h-4 w-4" />
                          {product.stock}
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="mr-1 inline h-4 w-4" />
                          Sin seguimiento
                        </>
                      )}
                    </div>
                  </div>

                  {product.variants && product.variants.length > 0 && (
                    <div className="text-muted-foreground mb-3 border-t pt-3 text-sm">
                      {product.variants.length} variante{product.variants.length > 1 ? 's' : ''}
                    </div>
                  )}

                  <div className="mt-auto flex items-center gap-1">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(product)}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {canEdit && product.trackStock && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setAdjustingProduct(product)}
                        title="Ajustar stock"
                      >
                        <Sliders className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" title="Eliminar">
                            <Trash2 className="text-destructive h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminar producto</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. ¿Estás seguro?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(product.id)}
                              className="bg-destructive hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-muted-foreground text-sm">
                Página {page} de {meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page === meta.totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={!!editingProductId} onOpenChange={(open) => !open && setEditingProductId(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar producto</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-sku">SKU *</Label>
                <Input id="edit-sku" {...editForm.register('sku')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nombre *</Label>
                <Input id="edit-name" {...editForm.register('name')} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="edit-description">Descripción</Label>
                <Input id="edit-description" {...editForm.register('description')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-price">Precio *</Label>
                <Input
                  id="edit-price"
                  type="number"
                  step="0.01"
                  min="0"
                  {...editForm.register('price', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-cost">Costo</Label>
                <Input
                  id="edit-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  {...editForm.register('cost', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-unit">Unidad</Label>
                <Input id="edit-unit" {...editForm.register('unit')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-categoryId">Categoría</Label>
                <Select
                  onValueChange={(value) => editForm.setValue('categoryId', value || undefined)}
                  defaultValue={editForm.watch('categoryId') || ''}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin categoría</SelectItem>
                    {categories?.data?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-stock">Stock</Label>
                <Input
                  id="edit-stock"
                  type="number"
                  min="0"
                  step="1"
                  {...editForm.register('stock', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-minStock">Stock mínimo</Label>
                <Input
                  id="edit-minStock"
                  type="number"
                  min="0"
                  step="1"
                  {...editForm.register('minStock', { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-maxStock">Stock máximo</Label>
                <Input
                  id="edit-maxStock"
                  type="number"
                  min="0"
                  step="1"
                  {...editForm.register('maxStock', { valueAsNumber: true })}
                />
              </div>
              <div className="flex items-end space-y-2">
                <Label htmlFor="edit-trackStock">Seguir stock</Label>
                <Input
                  id="edit-trackStock"
                  type="checkbox"
                  {...editForm.register('trackStock')}
                  className="h-4 w-4"
                />
              </div>
              <div className="flex items-end space-y-2">
                <Label htmlFor="edit-isActive">Activo</Label>
                <Input
                  id="edit-isActive"
                  type="checkbox"
                  {...editForm.register('isActive')}
                  className="h-4 w-4"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingProductId(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {adjustingProduct && (
        <StockAdjustDialog
          open={!!adjustingProduct}
          onOpenChange={(o) => !o && setAdjustingProduct(null)}
          productId={adjustingProduct.id}
          productName={adjustingProduct.name}
          currentStock={adjustingProduct.stock}
          variants={adjustingProduct.variants.map((v) => ({
            id: v.id,
            name: v.name,
            sku: v.sku,
            stock: v.stock,
            isActive: v.isActive,
          }))}
        />
      )}
    </div>
  );
}
