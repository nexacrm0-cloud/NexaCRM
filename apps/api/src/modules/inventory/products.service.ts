import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService, Prisma } from '@nexa/database';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  slugify(input: string): string {
    return (
      input
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'cat'
    );
  }

  async listCategories(organizationId: string) {
    return this.prisma.category.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(organizationId: string, name: string, color?: string) {
    return this.prisma.category.create({
      data: {
        organizationId,
        name,
        slug: this.slugify(name),
        color,
      },
    });
  }

  async findAll(
    organizationId: string,
    params: {
      search?: string;
      categoryId?: string;
      status?: 'all' | 'active' | 'lowStock';
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { search, categoryId, status = 'all' } = params;
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, params.limit ?? 20);

    const where: Prisma.ProductWhereInput = { organizationId };
    const and: Prisma.ProductWhereInput[] = [];
    if (search) {
      and.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (categoryId) {
      and.push({ categoryId });
    }
    if (and.length) where.AND = and;

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { category: true, variants: true, _count: { select: { movements: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    let filtered = items;
    if (status === 'active') filtered = filtered.filter((p) => p.isActive);
    if (status === 'lowStock')
      filtered = filtered.filter((p) => {
        if (!p.trackStock) return false;
        return p.stock <= (p.minStock ?? 0);
      });

    return { data: filtered, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async dashboard(organizationId: string) {
    const products = await this.prisma.product.findMany({
      where: { organizationId },
      select: {
        id: true,
        sku: true,
        name: true,
        price: true,
        cost: true,
        stock: true,
        minStock: true,
        trackStock: true,
        isActive: true,
        categoryId: true,
      },
    });

    const total = products.length;
    const activeProducts = products.filter((p) => p.isActive).length;
    const trackedProducts = products.filter((p) => p.trackStock);

    const lowStock = trackedProducts
      .filter((p) => p.minStock != null && p.stock <= p.minStock)
      .map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        stock: p.stock,
        minStock: p.minStock,
        deficit: (p.minStock ?? 0) - p.stock,
      }))
      .sort((a, b) => b.deficit - a.deficit)
      .slice(0, 8);

    const inventoryValue = trackedProducts.reduce(
      (sum, p) => sum + Number(p.stock ?? 0) * Number((p.cost ?? 0 === 0) ? p.price : p.cost),
      0,
    );

    const potentialRevenue = trackedProducts.reduce(
      (sum, p) => sum + Number(p.stock ?? 0) * Number(p.price),
      0,
    );

    const unitsOnHand = trackedProducts.reduce((sum, p) => sum + Number(p.stock ?? 0), 0);

    const sinStock = trackedProducts.filter((p) => p.stock <= 0).length;

    // Top movers from last 30 days: count OUT movements weighted by quantity
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        organizationId,
        type: 'OUT',
        createdAt: { gte: since },
      },
      select: { productId: true, quantity: true },
    });
    const counts = new Map<string, number>();
    for (const m of movements) {
      counts.set(m.productId, (counts.get(m.productId) ?? 0) + m.quantity);
    }
    const topMovers = Array.from(counts.entries())
      .map(([productId, qty]) => {
        const p = products.find((x) => x.id === productId);
        return {
          id: productId,
          sku: p?.sku ?? '',
          name: p?.name ?? '(eliminado)',
          movedQuantity: qty,
        };
      })
      .sort((a, b) => b.movedQuantity - a.movedQuantity)
      .slice(0, 5);

    return {
      summary: {
        totalProducts: total,
        activeProducts,
        trackedProducts: trackedProducts.length,
        unitsOnHand,
        sinStock,
        lowStock: lowStock.length,
        inventoryValue: Math.round(inventoryValue * 100) / 100,
        potentialRevenue: Math.round(potentialRevenue * 100) / 100,
      },
      lowStock,
      topMovers,
    };
  }

  async findOne(organizationId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId },
      include: {
        category: true,
        variants: { orderBy: { createdAt: 'asc' } },
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  async create(
    organizationId: string,
    data: {
      sku: string;
      name: string;
      description?: string;
      imageUrl?: string;
      price: number;
      cost?: number;
      unit?: string;
      trackStock?: boolean;
      stock?: number;
      minStock?: number;
      maxStock?: number;
      categoryId?: string | null;
      isActive?: boolean;
      variants?: Array<{
        sku?: string;
        name?: string;
        attributes?: Prisma.JsonValue;
        price?: number;
        stock?: number;
        minStock?: number;
        maxStock?: number;
      }>;
    },
    userId: string,
  ) {
    const existing = await this.prisma.product.findFirst({
      where: { organizationId, sku: data.sku },
    });
    if (existing) {
      throw new BadRequestException(`Ya existe un producto con SKU ${data.sku}`);
    }

    const hasVariants = (data.variants?.length ?? 0) > 0;

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          organizationId,
          sku: data.sku,
          name: data.name,
          description: data.description ?? null,
          imageUrl: data.imageUrl ?? null,
          price: new Prisma.Decimal(data.price ?? 0),
          cost: new Prisma.Decimal(data.cost ?? 0),
          unit: data.unit ?? null,
          trackStock: data.trackStock ?? true,
          stock: hasVariants ? 0 : Number(data.stock ?? 0),
          minStock: data.minStock ?? null,
          maxStock: data.maxStock ?? null,
          categoryId: data.categoryId ?? null,
          isActive: data.isActive ?? true,
        },
      });

      if (hasVariants) {
        for (const v of data.variants ?? []) {
          await tx.productVariant.create({
            data: {
              productId: product.id,
              sku: v.sku ?? null,
              name: v.name ?? null,
              attributes: (v.attributes ?? Prisma.JsonNull) as Prisma.InputJsonValue,
              price: v.price != null ? new Prisma.Decimal(v.price) : null,
              stock: Number(v.stock ?? 0),
              minStock: v.minStock ?? null,
              maxStock: v.maxStock ?? null,
            },
          });
        }
      }

      // Initial stock movement if any
      const variantTotal = hasVariants
        ? (data.variants ?? []).reduce((acc, v) => acc + Number(v.stock ?? 0), 0)
        : 0;
      const initialQty = hasVariants ? variantTotal : Number(data.stock ?? 0);
      if (initialQty > 0) {
        await tx.stockMovement.create({
          data: {
            organizationId,
            productId: product.id,
            productVariantId: null,
            type: 'IN',
            quantity: initialQty,
            reason: 'Inventario inicial',
            reference: 'manual',
            createdById: userId,
          },
        });
      }

      return product;
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: {
      sku?: string;
      name?: string;
      description?: string | null;
      imageUrl?: string | null;
      price?: number;
      cost?: number;
      unit?: string | null;
      trackStock?: boolean;
      minStock?: number | null;
      maxStock?: number | null;
      categoryId?: string | null;
      isActive?: boolean;
    },
  ) {
    const existing = await this.prisma.product.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Producto no encontrado');

    if (data.sku && data.sku !== existing.sku) {
      const dup = await this.prisma.product.findFirst({
        where: { organizationId, sku: data.sku, NOT: { id } },
      });
      if (dup) throw new BadRequestException(`Ya existe un producto con SKU ${data.sku}`);
    }

    const payload: Prisma.ProductUpdateInput = {};
    if (data.sku !== undefined) payload.sku = data.sku;
    if (data.name !== undefined) payload.name = data.name;
    if (data.description !== undefined) payload.description = data.description ?? null;
    if (data.imageUrl !== undefined) payload.imageUrl = data.imageUrl ?? null;
    if (data.price !== undefined) payload.price = new Prisma.Decimal(data.price);
    if (data.cost !== undefined) payload.cost = new Prisma.Decimal(data.cost);
    if (data.unit !== undefined) payload.unit = data.unit ?? null;
    if (data.trackStock !== undefined) payload.trackStock = data.trackStock;
    if (data.minStock !== undefined) payload.minStock = data.minStock ?? null;
    if (data.maxStock !== undefined) payload.maxStock = data.maxStock ?? null;
    if (data.categoryId !== undefined) {
      payload.category = data.categoryId
        ? { connect: { id: data.categoryId } }
        : { disconnect: true };
    }
    if (data.isActive !== undefined) payload.isActive = data.isActive;

    return this.prisma.product.update({ where: { id }, data: payload });
  }

  async remove(organizationId: string, id: string) {
    const existing = await this.prisma.product.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Producto no encontrado');
    await this.prisma.product.delete({ where: { id } });
  }

  async addVariant(
    organizationId: string,
    productId: string,
    data: {
      sku?: string;
      name?: string;
      attributes?: Prisma.JsonValue;
      price?: number;
      stock?: number;
      minStock?: number;
      maxStock?: number;
    },
    userId: string,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    return this.prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.create({
        data: {
          productId,
          sku: data.sku ?? null,
          name: data.name ?? null,
          attributes: (data.attributes ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          price: data.price != null ? new Prisma.Decimal(data.price) : null,
          stock: Number(data.stock ?? 0),
          minStock: data.minStock ?? null,
          maxStock: data.maxStock ?? null,
        },
      });
      const stock = Number(data.stock ?? 0);
      if (stock > 0) {
        await tx.stockMovement.create({
          data: {
            organizationId,
            productId: product.id,
            productVariantId: variant.id,
            type: 'IN',
            quantity: stock,
            reason: 'Stock inicial de variante',
            reference: 'manual',
            createdById: userId,
          },
        });
      }
      return variant;
    });
  }

  async removeVariant(organizationId: string, productId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, product: { id: productId, organizationId } },
    });
    if (!variant) throw new NotFoundException('Variante no encontrada');
    await this.prisma.productVariant.delete({ where: { id: variantId } });
  }

  async recordMovement(
    organizationId: string,
    productId: string,
    data: {
      type: 'IN' | 'OUT' | 'ADJUST';
      quantity: number;
      variantId?: string | null;
      reason?: string;
      reference?: string;
    },
    userId: string,
  ) {
    if (!Number.isFinite(data.quantity) || data.quantity <= 0) {
      throw new BadRequestException('La cantidad debe ser un entero positivo');
    }
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    return this.prisma.$transaction(async (tx) => {
      if (data.variantId) {
        const variant = await tx.productVariant.findFirst({
          where: { id: data.variantId, productId },
        });
        if (!variant) throw new NotFoundException('Variante no encontrada');

        const nextStock =
          data.type === 'IN'
            ? variant.stock + data.quantity
            : data.type === 'OUT'
              ? variant.stock - data.quantity
              : data.quantity; // ADJUST sets to exact

        if (nextStock < 0) {
          throw new BadRequestException(
            `Stock insuficiente para variante (${variant.sku ?? variant.name ?? variant.id}): hay ${variant.stock}, intentás restar ${data.quantity}.`,
          );
        }
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { stock: nextStock },
        });

        await tx.stockMovement.create({
          data: {
            organizationId,
            productId,
            productVariantId: variant.id,
            type: data.type,
            quantity: data.quantity,
            reason: data.reason ?? null,
            reference: data.reference ?? null,
            createdById: userId,
          },
        });

        // Roll up to product totals
        const all = await tx.productVariant.findMany({
          where: { productId },
          select: { stock: true, reservedStock: true },
        });
        const totalStock = all.reduce((acc, v) => acc + v.stock, 0);
        await tx.product.update({
          where: { id: productId },
          data: { stock: totalStock },
        });
        // Note: not updating reservedStock totals unless reserved stock changes; here it's fine.
      } else {
        const nextStock =
          data.type === 'IN'
            ? product.stock + data.quantity
            : data.type === 'OUT'
              ? product.stock - data.quantity
              : data.quantity;

        if (nextStock < 0) {
          throw new BadRequestException(
            `Stock insuficiente para el producto (hay ${product.stock}, intentás restar ${data.quantity}).`,
          );
        }
        await tx.product.update({
          where: { id: productId },
          data: { stock: nextStock },
        });
        await tx.stockMovement.create({
          data: {
            organizationId,
            productId,
            productVariantId: null,
            type: data.type,
            quantity: data.quantity,
            reason: data.reason ?? null,
            reference: data.reference ?? null,
            createdById: userId,
          },
        });
      }

      return tx.product.findFirst({
        where: { id: productId },
        include: { variants: true },
      });
    });
  }

  /**
   * Atomically drain stock across a list of { productVariantId, quantity } items.
   * Throws BadRequest if any item has insufficient stock.
   */
  async drainForInvoice(
    organizationId: string,
    items: Array<{ productVariantId: string; quantity: number; description: string }>,
    invoiceId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const consolidation: Record<string, number> = {};
      for (const i of items) {
        consolidation[i.productVariantId] = (consolidation[i.productVariantId] ?? 0) + i.quantity;
      }

      for (const [variantId, qty] of Object.entries(consolidation)) {
        const variant = await tx.productVariant.findUnique({
          where: { id: variantId },
          include: { product: true },
        });
        if (!variant) {
          throw new BadRequestException(`Variante ${variantId} no encontrada en factura`);
        }
        if (variant.product.organizationId !== organizationId) {
          throw new BadRequestException('Variante no pertenece a la organización');
        }
        if (variant.stock < qty) {
          const label = variant.sku ?? variant.name ?? variant.id;
          throw new BadRequestException(
            `Stock insuficiente para ${variant.product.name} (${label}): hay ${variant.stock}, factura pide ${qty}.`,
          );
        }
        await tx.productVariant.update({
          where: { id: variantId },
          data: { stock: variant.stock - qty },
        });
        await tx.stockMovement.create({
          data: {
            organizationId,
            productId: variant.productId,
            productVariantId: variantId,
            type: 'OUT',
            quantity: qty,
            reason: `Venta — factura`,
            reference: invoiceId,
            relatedInvoiceId: invoiceId,
          },
        });
      }

      // Roll up totals to product
      const variantIds = Object.keys(consolidation);
      if (variantIds.length) {
        const all = await tx.productVariant.groupBy({
          where: { id: { in: variantIds } },
          by: ['productId'],
          _sum: { stock: true },
        });
        for (const row of all) {
          await tx.product.update({
            where: { id: row.productId },
            data: { stock: row._sum.stock ?? 0 },
          });
        }
      }
    });
  }

  /**
   * Compensacion de drainForInvoice: devuelve el stock drenado por una factura.
   * Se usa cuando la emision fiscal (AFIP) falla despues del drenado, para no
   * dejar el stock descontado de una factura que nunca se emitio.
   */
  async releaseForInvoice(invoiceId: string, organizationId: string) {
    return this.prisma.$transaction(async (tx) => {
      const movements = await tx.stockMovement.findMany({
        where: { relatedInvoiceId: invoiceId, organizationId, type: 'OUT' },
      });
      if (movements.length === 0) return;

      for (const mv of movements) {
        if (!mv.productVariantId) continue;
        const variant = await tx.productVariant.findUnique({
          where: { id: mv.productVariantId },
        });
        if (!variant) continue;
        await tx.productVariant.update({
          where: { id: mv.productVariantId },
          data: { stock: variant.stock + mv.quantity },
        });
        await tx.stockMovement.create({
          data: {
            organizationId,
            productId: mv.productId,
            productVariantId: mv.productVariantId,
            type: 'RELEASE',
            quantity: mv.quantity,
            reason: 'Compensacion — emision fiscal fallida',
            reference: invoiceId,
            relatedInvoiceId: invoiceId,
          },
        });
      }

      const productIds = [...new Set(movements.map((m) => m.productId))];
      for (const productId of productIds) {
        const agg = await tx.productVariant.aggregate({
          where: { productId },
          _sum: { stock: true },
        });
        await tx.product.update({
          where: { id: productId },
          data: { stock: agg._sum.stock ?? 0 },
        });
      }
    });
  }
}
