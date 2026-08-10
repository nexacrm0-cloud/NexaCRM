import { ToolDefinition, ToolContext, ToolResult } from '../tool.interface';
import { PrismaService } from '@nexa/database';
import { EventBusService } from '../../event-bus/event-bus.service';

type ToolFactory = (prisma: PrismaService, eventBus: EventBusService) => ToolDefinition;

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('es')}`;
}

export const get_inventory_summary: ToolFactory = (prisma) => ({
  name: 'get_inventory_summary',
  displayName: 'Resumen de Inventario',
  description: 'Obtener un resumen del inventario: SKUs activos, valor total y unidades',
  category: 'CRUD',
  keywords: ['stock', 'inventario', 'existencias', 'tengo', 'hay', 'resumen', 'valor'],
  permissions: [],
  inputSchema: { type: 'object', properties: {} },
  handler: async (_params, context: ToolContext): Promise<ToolResult> => {
    const products = await prisma.product.findMany({
      where: { organizationId: context.organizationId, isActive: true, trackStock: true },
    });
    const totalUnits = products.reduce((sum, p) => sum + (p.stock ?? 0), 0);
    const totalValue = products.reduce((sum, p) => sum + (p.stock ?? 0) * Number(p.cost), 0);
    const lowStock = products.filter(
      (p) => p.minStock != null && p.stock < (p.minStock ?? 0),
    ).length;
    return {
      success: true,
      data: {
        skus: products.length,
        totalUnits,
        totalValue,
        lowStockCount: lowStock,
      },
      naturalLanguage: `Inventario: ${products.length} SKUs, ${totalUnits} unidades, valor ${formatCurrency(totalValue)}, ${lowStock} con stock bajo.`,
    };
  },
});

export const get_low_stock_products: ToolFactory = (prisma) => ({
  name: 'get_low_stock_products',
  displayName: 'Productos con Stock Bajo',
  description: 'Obtener productos cuyo stock está por debajo del mínimo definido',
  category: 'CRUD',
  keywords: [
    'productos',
    'items',
    'stock',
    'bajo',
    'low',
    'reponer',
    'reordenar',
    'pedir',
    'faltantes',
  ],
  permissions: [],
  inputSchema: { type: 'object', properties: {} },
  handler: async (_params, context: ToolContext): Promise<ToolResult> => {
    const products = await prisma.product.findMany({
      where: {
        organizationId: context.organizationId,
        isActive: true,
        trackStock: true,
        minStock: { not: null },
        NOT: { stock: { gte: prisma.product.fields.minStock } },
      },
    });
    const filtered = products.filter((p) => p.stock < (p.minStock ?? 0));
    return {
      success: true,
      data: { products: filtered, count: filtered.length },
      naturalLanguage: `Hay ${filtered.length} productos con stock bajo mínimos.`,
    };
  },
});

export const get_product_stock: ToolFactory = (prisma) => ({
  name: 'get_product_stock',
  displayName: 'Stock de un Producto',
  description: 'Obtener el stock actual de un producto buscando por nombre o SKU',
  category: 'CRUD',
  keywords: ['stock', 'de', 'del', 'cuánto', 'hay', 'existencias', 'producto', 'sku'],
  permissions: [],
  inputSchema: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
  },
  handler: async (params, context: ToolContext): Promise<ToolResult> => {
    const query = String(params.query ?? '').trim();
    if (!query) {
      return {
        success: false,
        error: 'Falta el parámetro "query"',
        naturalLanguage: '¿De qué producto quieres ver el stock?',
      };
    }
    const products = await prisma.product.findMany({
      where: {
        organizationId: context.organizationId,
        OR: [
          { sku: { contains: query, mode: 'insensitive' as const } },
          { name: { contains: query, mode: 'insensitive' as const } },
        ],
      },
      include: { variants: true },
      take: 10,
    });
    if (products.length === 0) {
      return {
        success: false,
        error: `Producto "${query}" no encontrado`,
        naturalLanguage: `No encontré el producto "${query}".`,
      };
    }
    return {
      success: true,
      data: { products, count: products.length },
      naturalLanguage: `Encontré ${products.length} producto(s) para "${query}".`,
    };
  },
});

export const inventoryTools: ToolFactory[] = [
  get_inventory_summary,
  get_low_stock_products,
  get_product_stock,
];
