import { Injectable } from '@nestjs/common';
import { PrismaService, Prisma } from '@nexa/database';

@Injectable()
export class InventorySearchService {
  constructor(private prisma: PrismaService) {}

  async search(organizationId: string, q: string, limit: number) {
    const trimmed = q.trim();
    if (!trimmed) return { data: [] };

    const orFilters: Prisma.ProductWhereInput[] = [
      { name: { contains: trimmed, mode: 'insensitive' } },
      { sku: { contains: trimmed, mode: 'insensitive' } },
    ];
    if (trimmed.length > 0) {
      orFilters.push({ description: { contains: trimmed, mode: 'insensitive' } });
    }

    const products = await this.prisma.product.findMany({
      where: { organizationId, isActive: true, OR: orFilters },
      take: limit,
      orderBy: { name: 'asc' },
      include: {
        variants: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
        category: { select: { id: true, name: true, color: true } },
      },
    });

    return {
      data: products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description ?? null,
        price: Number(p.price),
        unit: p.unit ?? null,
        stock: p.stock,
        trackStock: p.trackStock,
        category: p.category
          ? { id: p.category.id, name: p.category.name, color: p.category.color }
          : null,
        variants: p.variants.map((v) => ({
          id: v.id,
          name: v.name ?? v.sku ?? 'Variante',
          sku: v.sku,
          attributes: v.attributes,
          price: v.price != null ? Number(v.price) : Number(p.price),
          stock: v.stock,
          reservedStock: v.reservedStock,
          available: v.stock - v.reservedStock,
        })),
      })),
    };
  }
}
