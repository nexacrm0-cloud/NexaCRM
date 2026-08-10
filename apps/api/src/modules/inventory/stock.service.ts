import { Injectable } from '@nestjs/common';
import { PrismaService } from '@nexa/database';
import { ProductsService } from './products.service';

@Injectable()
export class StockService {
  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
  ) {}

  listAllMovements(
    organizationId: string,
    params: { page: number; limit: number; productId?: string; type?: 'IN' | 'OUT' | 'ADJUST' },
  ) {
    const skip = (params.page - 1) * params.limit;
    const where: any = { organizationId };
    if (params.productId) where.productId = params.productId;
    if (params.type) where.type = params.type;
    return Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: params.limit,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          product: { select: { id: true, name: true, sku: true } },
          productVariant: { select: { id: true, name: true, sku: true } },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]).then(([data, total]) => ({
      data,
      meta: {
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit),
      },
    }));
  }

  listMovements(
    organizationId: string,
    productId: string,
    params: { page: number; limit: number },
  ) {
    const skip = (params.page - 1) * params.limit;
    return Promise.all([
      this.prisma.stockMovement.findMany({
        where: { organizationId, productId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: params.limit,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          productVariant: { select: { id: true, name: true, sku: true } },
        },
      }),
      this.prisma.stockMovement.count({ where: { organizationId, productId } }),
    ]).then(([data, total]) => ({
      data,
      meta: {
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit),
      },
    }));
  }

  recordMovement(
    organizationId: string,
    productId: string,
    body: {
      type: 'IN' | 'OUT' | 'ADJUST';
      quantity: number;
      variantId?: string | null;
      reason?: string;
      reference?: string;
    },
    userId: string,
  ) {
    return this.productsService.recordMovement(organizationId, productId, body, userId);
  }
}
