import { Injectable, Logger } from '@nestjs/common';
import type { AfipProvider, AfipIssueInput, AfipIssueResult } from './afip-provider.interface';
import { CBTE_TIPO_BY_INVOICE_TYPE } from './afip.constants';

/**
 * Stub de AFIP para dev/test. Devuelve un CAE deterministico con prefijo "T-"
 * (test) y una fecha de vencimiento a 10 dias, sin tocar la red.
 * NUNCA usar en produccion real: el CAE no es valido fiscalmente.
 */
@Injectable()
export class StubAfipProvider implements AfipProvider {
  readonly kind = 'stub';
  private readonly logger = new Logger(StubAfipProvider.name);
  private lastVoucherByPosAndType = new Map<string, number>();

  async getLastVoucher(pointOfSale: string, cbteTipo: number): Promise<number> {
    const key = `${pointOfSale}-${cbteTipo}`;
    return this.lastVoucherByPosAndType.get(key) ?? 0;
  }

  async requestCae(input: AfipIssueInput): Promise<AfipIssueResult> {
    const cbteTipo = CBTE_TIPO_BY_INVOICE_TYPE[input.invoiceType];
    const key = `${input.pointOfSale}-${cbteTipo}`;
    const next = (this.lastVoucherByPosAndType.get(key) ?? 0) + 1;
    this.lastVoucherByPosAndType.set(key, next);

    const cae = `T-${Date.now().toString(36)}-${next}`.toUpperCase();
    const caeExpiresAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

    this.logger.warn(
      `[STUB AFIP] CAE ficticio ${cae} para ${input.invoiceType} POS ${input.pointOfSale} Nro ${next} total ${input.total}`,
    );

    return {
      cae,
      caeExpiresAt,
      invoiceNumber: String(next),
    };
  }
}
