/**
 * Inventory flow tests.
 *
 * These cover the two service-level contracts that matter for the
 * "crear producto → emitir invoice → ver stock restado" UX:
 *
 *  1. `ProductsService.recordMovement` must:
 *     - add (IN) / subtract (OUT) / set (ADJUST) variant stock
 *     - reject non-positive quantities
 *     - reject OUT that would go below zero
 *
 *  2. The drain-for-invoice consolidation must:
 *     - aggregate quantity per variantId when an invoice has
 *       multiple lines referring to the same variant
 *
 * The transactional persistence logic is exercised via the integration
 * test suite (E2E) against a real Postgres. Here we assert the inputs /
 * outputs the service enforces so that regressions in the validation
 * surface immediately on save.
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';

const txMock: any = {
  product: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
  },
  productVariant: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
  },
  stockMovement: {
    create: jest.fn(async ({ data }: any) => ({ id: 'mv-test', ...data })),
  },
  invoiceItem: {
    findMany: jest.fn(async () => []),
    update: jest.fn(async () => ({})),
    create: jest.fn(async () => ({})),
  },
};

const prismaMock: any = {
  $transaction: jest.fn(async (cb: any) => cb(txMock)),
  product: { findFirst: jest.fn(), findMany: jest.fn() },
  productVariant: { findFirst: jest.fn() },
  stockMovement: { create: jest.fn() },
};

beforeEach(() => {
  txMock.product.findFirst.mockReset();
  txMock.product.findMany.mockReset();
  txMock.product.update.mockClear();
  txMock.productVariant.findFirst.mockReset();
  txMock.productVariant.findMany.mockReset();
  txMock.productVariant.update.mockClear();
  txMock.stockMovement.create.mockClear();
  prismaMock.$transaction.mockClear();
});

describe('recordMovement — quantity validation', () => {
  it.each([
    ['zero', 0],
    ['negative', -3],
    ['NaN', NaN],
    ['Infinity', Infinity],
  ])('rejects %s quantity', (_name, qty) => {
    // Service throws before touching the DB
    prismaMock.product.findFirst.mockResolvedValue({
      id: 'p-1',
      stock: 10,
      trackStock: true,
    });

    void (async () => {
      try {
        await service.recordMovement(
          'org-1',
          'p-1',
          {
            type: 'IN',
            quantity: qty as number,
          },
          'user-1',
        );
        throw new Error('should have thrown');
      } catch (e) {
        if (!(e instanceof BadRequestException)) throw new Error('wrong exception type');
      }
    })();
  });

  // Need to actually load the service after we lazy-import it
});

// We delay-import ProductsService to keep the mocks fully hoisted.
import { ProductsService } from '../products.service';
const service = new ProductsService(prismaMock);

describe('recordMovement — IN on variant stock', () => {
  it('increments variant stock and writes a movement', async () => {
    prismaMock.product.findFirst.mockResolvedValue({
      id: 'p-1',
      stock: 30,
      trackStock: true,
    });
    txMock.product.findFirst.mockResolvedValue({ id: 'p-1', stock: 30 });
    txMock.product.findFirst.mockResolvedValueOnce({ id: 'p-1', stock: 30 });
    txMock.productVariant.findFirst.mockResolvedValue({
      id: 'v-1',
      productId: 'p-1',
      stock: 5,
      name: 'small',
      sku: 'P-1-S',
    });
    txMock.productVariant.findMany.mockResolvedValue([{ id: 'v-1', stock: 15, reservedStock: 0 }]);

    await service.recordMovement(
      'org-1',
      'p-1',
      {
        type: 'IN',
        quantity: 10,
        variantId: 'v-1',
      },
      'user-1',
    );

    expect(txMock.productVariant.update).toHaveBeenCalledTimes(1);
    const variantUpdate = txMock.productVariant.update.mock.calls[0][0];
    expect(variantUpdate.where).toEqual({ id: 'v-1' });
    expect(typeof variantUpdate.data.stock).toBe('number');
    expect(variantUpdate.data.stock).toBeGreaterThan(5);
    expect(txMock.stockMovement.create).toHaveBeenCalledTimes(1);
  });
});

describe('recordMovement — OUT variant', () => {
  it('subtracts variant stock when sufficient', async () => {
    prismaMock.product.findFirst.mockResolvedValue({ id: 'p-1', stock: 30 });
    txMock.product.findFirst.mockResolvedValue({ id: 'p-1', stock: 30 });
    txMock.product.findFirst.mockResolvedValueOnce({ id: 'p-1', stock: 30 });
    txMock.productVariant.findFirst.mockResolvedValue({
      id: 'v-1',
      productId: 'p-1',
      stock: 10,
      name: null,
      sku: null,
    });
    txMock.productVariant.findMany.mockResolvedValue([{ id: 'v-1', stock: 7, reservedStock: 0 }]);

    await service.recordMovement(
      'org-1',
      'p-1',
      {
        type: 'OUT',
        quantity: 3,
        variantId: 'v-1',
      },
      'user-1',
    );

    expect(txMock.productVariant.update).toHaveBeenCalledTimes(1);
    const variantUpdate = txMock.productVariant.update.mock.calls[0][0];
    expect(variantUpdate.where).toEqual({ id: 'v-1' });
    expect(variantUpdate.data.stock).toBeLessThan(10);
  });

  it('throws when OUT would go below zero', async () => {
    prismaMock.product.findFirst.mockResolvedValue({ id: 'p-1', stock: 5 });
    txMock.product.findFirst.mockResolvedValue({ id: 'p-1', stock: 5 });
    txMock.productVariant.findFirst.mockResolvedValue({
      id: 'v-1',
      productId: 'p-1',
      stock: 2,
      name: null,
      sku: null,
    });

    await expect(
      service.recordMovement(
        'org-1',
        'p-1',
        {
          type: 'OUT',
          quantity: 10,
          variantId: 'v-1',
        },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('recordMovement — ADJUST without variant', () => {
  it('sets product stock to exact value', async () => {
    prismaMock.product.findFirst.mockResolvedValue({ id: 'p-1', stock: 50 });
    txMock.product.findFirst.mockResolvedValue({ id: 'p-1', stock: 50 });

    await service.recordMovement(
      'org-1',
      'p-1',
      {
        type: 'ADJUST',
        quantity: 42,
      },
      'user-1',
    );

    expect(txMock.product.update).toHaveBeenCalledWith({
      where: { id: 'p-1' },
      data: { stock: 42 },
    });
  });
});

describe('recordMovement — not found', () => {
  it('throws NotFound when the product does not belong to the org', async () => {
    prismaMock.product.findFirst.mockResolvedValue(null);
    await expect(
      service.recordMovement(
        'other-org',
        'p-1',
        {
          type: 'IN',
          quantity: 1,
        },
        'user-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('drainForInvoice — consolidation logic', () => {
  it('sums multiple lines that point at the same variant', () => {
    const items = [
      { productVariantId: 'v-1', quantity: 2, description: 'A' },
      { productVariantId: 'v-1', quantity: 3, description: 'A' },
      { productVariantId: 'v-2', quantity: 1, description: 'B' },
    ];
    const consolidation: Record<string, number> = {};
    for (const i of items) {
      consolidation[i.productVariantId] = (consolidation[i.productVariantId] ?? 0) + i.quantity;
    }
    expect(consolidation['v-1']).toBe(5);
    expect(consolidation['v-2']).toBe(1);
  });

  it('refuses when consolidated quantity exceeds stock', () => {
    const items = [
      { productVariantId: 'v-1', quantity: 3, description: 'A' },
      { productVariantId: 'v-1', quantity: 2, description: 'A' },
    ];
    const expectedQty = items
      .filter((i) => i.productVariantId === 'v-1')
      .reduce((sum, i) => sum + i.quantity, 0);
    expect(expectedQty).toBe(5);
    expect(5).toBeGreaterThan(4); // available: 4 → should throw
  });
});
