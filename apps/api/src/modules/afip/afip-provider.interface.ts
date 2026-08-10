import type { InvoiceType } from '@nexa/database';

export type AfipIssueInput = {
  invoiceType: InvoiceType;
  pointOfSale: string;
  date: Date;
  /** 1=productos, 2=servicios, 3=productos y servicios */
  concepto: 1 | 2 | 3;
  /** 80=CUIT, 86=CUIL, 87=CDI, 99=Consumidor Final */
  docType: number;
  /** CUIT del receptor o null para consumidor final */
  docNumber: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
};

export type AfipIssueResult = {
  cae: string;
  caeExpiresAt: Date;
  /** NroCbte asignado por AFIP, sin padding */
  invoiceNumber: string;
};

export interface AfipProvider {
  readonly kind: string;
  /** Ultimo comprobante autorizado para el POS + CbteTipo. */
  getLastVoucher(pointOfSale: string, cbteTipo: number): Promise<number>;
  /** FECAESolicitar: pide CAE a AFIP. */
  requestCae(input: AfipIssueInput): Promise<AfipIssueResult>;
}
