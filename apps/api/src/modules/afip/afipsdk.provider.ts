import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { readFileSync } from 'fs';
import type { AfipProvider, AfipIssueInput, AfipIssueResult } from './afip-provider.interface';
import { CBTE_TIPO_BY_INVOICE_TYPE, AFIP_MONEDA_PESOS } from './afip.constants';

// eslint-disable-next-line @typescript-eslint/no-var-requires
import Afip from '@afipsdk/afip.js';

/**
 * IDs de alicuota IVA segun AFIP WSFE (FEParamGetTiposIva):
 * 3=0%, 4=10.5%, 5=21%, 6=27%, 8=5%, 9=2.5%
 */
const IVA_ID_BY_RATE: Record<string, number> = {
  '0': 3,
  '10.5': 4,
  '21': 5,
  '27': 6,
  '5': 8,
  '2.5': 9,
};

function ivaIdForRate(rate: number): number | null {
  const key = String(Number(rate.toFixed(2)));
  return IVA_ID_BY_RATE[key] ?? null;
}

function toAfipDate(d: Date): number {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return Number(`${y}${m}${day}`);
}

/**
 * Provider real de AFIP WSFE via @afipsdk/afip.js.
 *
 * Requiere:
 *  - AFIP_CUIT: CUIT del emisor (sin guiones)
 *  - AFIP_CERT_PATH + AFIP_KEY_PATH: certificado X.509 PEM y clave privada PEM
 *    (generados desde la web de AFIP: Administracion de Certificados Digitales)
 *  - AFIP_ENV: 'production' | 'testing' (homologacion)
 */
@Injectable()
export class AfipsdkProvider implements AfipProvider {
  readonly kind = 'afipsdk';
  private readonly logger = new Logger(AfipsdkProvider.name);
  private afip: any = null;
  private readonly initialized: boolean = false;

  constructor() {
    const cuit = process.env.AFIP_CUIT;
    const certPath = process.env.AFIP_CERT_PATH;
    const keyPath = process.env.AFIP_KEY_PATH;
    const isProd = process.env.AFIP_ENV === 'production';

    if (!cuit || !certPath || !keyPath) {
      this.logger.warn(
        'AFIP_CUIT / AFIP_CERT_PATH / AFIP_KEY_PATH no configurados. AfipsdkProvider inactivo.',
      );
      return;
    }

    try {
      const cert = readFileSync(certPath, 'utf8');
      const key = readFileSync(keyPath, 'utf8');

      this.afip = new Afip({
        CUIT: cuit,
        cert,
        key,
        production: isProd,
        // access_token requerido por el SDK aunque usemos cert propio;
        // se deja vacio y el SDK usa el flujo WSAA directo con cert+key.
        access_token: process.env.AFIP_SDK_ACCESS_TOKEN || '',
      });

      this.initialized = true;
      this.logger.log(
        `AfipsdkProvider inicializado (CUIT ${cuit}, env=${isProd ? 'production' : 'testing'})`,
      );
    } catch (err) {
      this.logger.error(
        `No se pudieron leer los certificados AFIP: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }

  async getLastVoucher(pointOfSale: string, cbteTipo: number): Promise<number> {
    this.assertInitialized();
    try {
      const pos = parseInt(pointOfSale, 10);
      return await this.afip.ElectronicBilling.getLastVoucher(pos, cbteTipo);
    } catch (err) {
      this.logAfipError('getLastVoucher', err);
      throw new InternalServerErrorException('AFIP: no se pudo obtener el ultimo comprobante');
    }
  }

  async requestCae(input: AfipIssueInput): Promise<AfipIssueResult> {
    this.assertInitialized();

    const cbteTipo = CBTE_TIPO_BY_INVOICE_TYPE[input.invoiceType];
    const pos = parseInt(input.pointOfSale, 10);
    if (Number.isNaN(pos)) {
      throw new InternalServerErrorException(
        `AFIP: punto de venta invalido "${input.pointOfSale}"`,
      );
    }

    const ivaId = ivaIdForRate(input.taxRate);
    const voucher: Record<string, unknown> = {
      CantReg: 1,
      PtoVta: pos,
      CbteTipo: cbteTipo,
      Concepto: input.concepto,
      DocTipo: input.docType,
      DocNro: input.docNumber ? Number(input.docNumber.replace(/\D/g, '')) : 0,
      CbteFch: toAfipDate(input.date),
      ImpTotal: round2(input.total),
      ImpTotConc: 0,
      ImpNeto: round2(input.subtotal),
      ImpOpEx: 0,
      ImpTrib: 0,
      ImpIVA: round2(input.taxAmount),
      MonId: 'PES',
      MonCotiz: AFIP_MONEDA_PESOS === 1 ? 1 : 1,
    };

    // Factura C no discrimina IVA; A/B/E/M si (cuando hay IVA).
    if (input.taxAmount > 0 && ivaId !== null && input.invoiceType !== 'C') {
      voucher.Iva = [
        {
          Id: ivaId,
          BaseImp: round2(input.subtotal),
          Importe: round2(input.taxAmount),
        },
      ];
    } else if (input.invoiceType !== 'C' && input.taxAmount > 0 && ivaId === null) {
      throw new InternalServerErrorException(
        `AFIP: alicuota IVA ${input.taxRate}% no reconocida (validas: 0, 2.5, 5, 10.5, 21, 27)`,
      );
    }

    // Servicios: AFIP exige fechas de servicio
    if (input.concepto === 2 || input.concepto === 3) {
      const fch = toAfipDate(input.date);
      voucher.FchServDesde = fch;
      voucher.FchServHasta = fch;
      voucher.FchVtoPago = fch;
    }

    try {
      const res = await this.afip.ElectronicBilling.createNextVoucher(voucher);
      // res = { CAE, CAEFchVto: 'yyyy-mm-dd', voucherNumber }
      if (!res || !res.CAE) {
        throw new Error('AFIP no devolvio CAE');
      }
      return {
        cae: String(res.CAE),
        caeExpiresAt: new Date(`${res.CAEFchVto}T23:59:59`),
        invoiceNumber: String(res.voucherNumber),
      };
    } catch (err) {
      this.logAfipError('requestCae', err);
      const msg =
        err instanceof Error && err.message
          ? err.message.slice(0, 300)
          : 'Error desconocido de AFIP';
      throw new InternalServerErrorException(`AFIP rechazo la factura: ${msg}`);
    }
  }

  private assertInitialized(): void {
    if (!this.initialized || !this.afip) {
      throw new InternalServerErrorException(
        'AfipsdkProvider no configurado (faltan AFIP_CUIT / AFIP_CERT_PATH / AFIP_KEY_PATH).',
      );
    }
  }

  private logAfipError(operation: string, err: unknown): void {
    const msg = err instanceof Error ? err.message : String(err);
    this.logger.error(`AFIP ${operation} failed: ${msg.slice(0, 500)}`);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
