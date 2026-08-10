import { Test, TestingModule } from '@nestjs/testing';
import { StubAfipProvider } from '../stub-afip.provider';
import type { AfipProvider, AfipIssueInput } from '../afip-provider.interface';
import { InvoiceType } from '@nexa/database';

describe('Afip Providers', () => {
  const makeInput = (overrides: Partial<AfipIssueInput> = {}): AfipIssueInput => ({
    invoiceType: InvoiceType.B,
    pointOfSale: '0001',
    date: new Date('2026-08-06'),
    concepto: 1,
    docType: 99,
    docNumber: null,
    subtotal: 100,
    taxRate: 21,
    taxAmount: 21,
    total: 121,
    ...overrides,
  });

  // ---- STUB PROVIDER ----
  describe('StubAfipProvider', () => {
    let provider: StubAfipProvider;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [StubAfipProvider],
      }).compile();
      provider = module.get<StubAfipProvider>(StubAfipProvider);
    });

    it('has kind "stub"', () => {
      expect(provider.kind).toBe('stub');
    });

    it('getLastVoucher returns 0 for unknown POS+type', async () => {
      const result = await provider.getLastVoucher('0001', 6);
      expect(result).toBe(0);
    });

    it('requestCae returns deterministic CAE with T- prefix', async () => {
      const input = makeInput();
      const result = await provider.requestCae(input);

      expect(result.cae).toMatch(/^T-[A-Z0-9]+-\d+$/);
      expect(result.invoiceNumber).toBe('1');
      expect(result.caeExpiresAt).toBeInstanceOf(Date);
      expect(result.caeExpiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('increments invoice number per POS+type', async () => {
      await provider.requestCae(makeInput({ invoiceType: InvoiceType.B }));
      await provider.requestCae(makeInput({ invoiceType: InvoiceType.B }));
      const result = await provider.requestCae(makeInput({ invoiceType: InvoiceType.B }));
      expect(result.invoiceNumber).toBe('3');
    });

    it('maintains separate counters per invoiceType', async () => {
      await provider.requestCae(makeInput({ invoiceType: InvoiceType.B }));
      await provider.requestCae(makeInput({ invoiceType: InvoiceType.A }));
      const resultB = await provider.requestCae(makeInput({ invoiceType: InvoiceType.B }));
      const resultA = await provider.requestCae(makeInput({ invoiceType: InvoiceType.A }));
      expect(resultB.invoiceNumber).toBe('2');
      expect(resultA.invoiceNumber).toBe('2');
    });

    it('returns different CAEs on each call', async () => {
      const r1 = await provider.requestCae(makeInput());
      const r2 = await provider.requestCae(makeInput());
      expect(r1.cae).not.toBe(r2.cae);
    });
  });
});
