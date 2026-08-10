import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoicesService } from '../invoices.service';
import { PrismaService } from '@nexa/database';
import { EventBusService } from '../../../event-bus/event-bus.service';
import { ProductsService } from '../../inventory/products.service';
import type { AfipProvider, AfipIssueInput } from '../../afip/afip-provider.interface';
import type { InvoiceType } from '@nexa/shared';

describe('InvoicesService — issue() con AFIP', () => {
  let service: InvoicesService;

  const mockTx = {
    invoice: {
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    invoiceItem: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((cb: any) => cb(mockTx)),
  } as any;
  const mockPrisma = {
    ...mockTx,
    invoice: mockTx.invoice,
    invoiceItem: mockTx.invoiceItem,
    $transaction: mockTx.$transaction,
  } as any;

  const mockEventBus = { emit: jest.fn() } as unknown as EventBusService;
  const mockInventory = {
    drainForInvoice: jest.fn().mockResolvedValue(undefined),
    releaseForInvoice: jest.fn().mockResolvedValue(undefined),
  };
  const mockRequestCae = jest.fn();
  const mockAfipProvider: AfipProvider = {
    kind: 'stub',
    requestCae: mockRequestCae,
    getLastVoucher: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));
    process.env.AFIP_ENABLED = 'true';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: ProductsService, useValue: mockInventory },
        { provide: 'AFIP_PROVIDER', useValue: mockAfipProvider },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  describe('issue()', () => {
    const existingInvoice = {
      id: 'inv-1',
      organizationId: 'org-1',
      status: 'DRAFT',
      invoiceType: 'B' as InvoiceType,
      pointOfSale: '0001',
      subtotal: 100,
      taxRate: 21,
      taxAmount: 21,
      total: 121,
      number: '00000001',
      cuit: '20345678901',
      client: { id: 'client-1', companyName: 'Acme', email: 'test@acme.com' },
      createdBy: { id: 'user-1', firstName: 'Admin', lastName: 'Nexa' },
      items: [
        {
          id: 'item-1',
          description: 'Prod 1',
          quantity: 1,
          unitPrice: 100,
          productVariantId: 'var-1',
        },
      ],
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockTx.invoice.findFirst.mockResolvedValue(existingInvoice);
      mockTx.invoiceItem.findMany.mockResolvedValue([
        { id: 'item-1', productVariantId: 'var-1', quantity: 1, description: 'Prod 1' },
      ]);
      mockTx.invoice.update.mockResolvedValue({
        ...existingInvoice,
        status: 'ISSUED',
        issuedAt: new Date(),
        cae: null,
        caeExpiresAt: null,
        client: existingInvoice.client,
        createdBy: existingInvoice.createdBy,
        items: existingInvoice.items,
      });
      mockInventory.drainForInvoice.mockResolvedValue(undefined);
      mockInventory.releaseForInvoice.mockResolvedValue(undefined);
      mockRequestCae.mockReset();
      process.env.AFIP_ENABLED = 'true';
    });

    it('throws NotFoundException if invoice not found', async () => {
      mockTx.invoice.findFirst.mockResolvedValueOnce(null);
      await expect(service.issue('bad-id', 'org-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if invoice not DRAFT', async () => {
      mockTx.invoice.findFirst.mockResolvedValueOnce({ ...existingInvoice, status: 'ISSUED' });
      await expect(service.issue('inv-1', 'org-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('emits invoice.issued with cae/cAEExpiresAt when AFIP stub succeeds', async () => {
      mockRequestCae.mockResolvedValueOnce({
        cae: 'T-ABC123-1',
        caeExpiresAt: new Date('2026-08-16T23:59:59'),
        invoiceNumber: '5',
      });

      // Override the update mock for this test to return invoice with CAE data
      mockTx.invoice.update.mockResolvedValueOnce({
        ...existingInvoice,
        status: 'ISSUED',
        issuedAt: new Date(),
        number: '00000005',
        cae: 'T-ABC123-1',
        caeExpiresAt: new Date('2026-08-16T23:59:59'),
        client: existingInvoice.client,
        createdBy: existingInvoice.createdBy,
        items: existingInvoice.items,
      });

      const result = await service.issue('inv-1', 'org-1', 'user-1');

      expect(result.status).toBe('ISSUED');
      expect(result.cae).toBe('T-ABC123-1');
      expect(result.caeExpiresAt).toBeInstanceOf(Date);
      expect(result.number).toBe('00000005');

      expect(mockRequestCae).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceType: 'B',
          pointOfSale: '0001',
          concepto: 1,
          docType: 80,
          docNumber: '20345678901',
          subtotal: 100,
          taxRate: 21,
          taxAmount: 21,
          total: 121,
        }),
      );

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'invoice.issued',
          payload: expect.objectContaining({
            cae: 'T-ABC123-1',
            caeExpiresAt: expect.any(Date),
          }),
        }),
      );
    });

    it('compensates stock (calls releaseForInvoice) when AFIP fails', async () => {
      mockRequestCae.mockRejectedValueOnce(new Error('AFIP timeout'));

      await expect(service.issue('inv-1', 'org-1', 'user-1')).rejects.toThrow(BadRequestException);

      expect(mockInventory.releaseForInvoice).toHaveBeenCalledWith('inv-1', 'org-1');
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('does not call AFIP when AFIP provider is not available', async () => {
      const moduleNoAfip = await Test.createTestingModule({
        providers: [
          InvoicesService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: EventBusService, useValue: mockEventBus },
          { provide: ProductsService, useValue: mockInventory },
        ],
      }).compile();
      const svcNoAfip = moduleNoAfip.get<InvoicesService>(InvoicesService);

      const result = await svcNoAfip.issue('inv-1', 'org-1', 'user-1');

      expect(result.status).toBe('ISSUED');
      expect(result.cae).toBeNull();
      expect(result.caeExpiresAt).toBeNull();
      expect(result.number).toBe('00000001');
    });

    it('uses concepto=2 (servicios) when no items with productVariantId', async () => {
      mockTx.invoiceItem.findMany.mockResolvedValueOnce([]);
      mockRequestCae.mockResolvedValueOnce({
        cae: 'T-ABC',
        caeExpiresAt: new Date(),
        invoiceNumber: '1',
      });

      await service.issue('inv-1', 'org-1', 'user-1');

      expect(mockRequestCae).toHaveBeenCalledWith(expect.objectContaining({ concepto: 2 }));
    });

    it('uses docType=99 (Consumidor Final) when no CUIT on invoice', async () => {
      mockTx.invoice.findFirst.mockResolvedValueOnce({ ...existingInvoice, cuit: null });
      mockRequestCae.mockResolvedValueOnce({
        cae: 'T-ABC',
        caeExpiresAt: new Date(),
        invoiceNumber: '1',
      });

      await service.issue('inv-1', 'org-1', 'user-1');

      expect(mockRequestCae).toHaveBeenCalledWith(
        expect.objectContaining({ docType: 99, docNumber: null }),
      );
    });

    it('emits cae and caeExpiresAt in event payload on success', async () => {
      mockRequestCae.mockResolvedValueOnce({
        cae: 'T-123',
        caeExpiresAt: new Date('2026-08-16T23:59:59'),
        invoiceNumber: '1',
      });

      // Override the update mock for this test to return invoice with CAE data
      mockTx.invoice.update.mockResolvedValueOnce({
        ...existingInvoice,
        status: 'ISSUED',
        issuedAt: new Date(),
        number: '00000001',
        cae: 'T-123',
        caeExpiresAt: new Date('2026-08-16T23:59:59'),
        client: existingInvoice.client,
        createdBy: existingInvoice.createdBy,
        items: existingInvoice.items,
      });

      await service.issue('inv-1', 'org-1', 'user-1');

      const emitCall = (mockEventBus.emit as jest.Mock).mock.calls[0][0];
      expect(emitCall.payload.cae).toBe('T-123');
      expect(emitCall.payload.caeExpiresAt).toBeInstanceOf(Date);
    });
  });
});
