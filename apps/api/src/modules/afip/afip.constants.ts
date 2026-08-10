import type { InvoiceType } from '@nexa/database';

/**
 * Mapeo InvoiceType (enum Nexa) -> CbteTipo (codigo AFIP WSFE).
 * 1=Factura A, 6=Factura B, 11=Factura C, 19=Factura E, 51=Factura M.
 */
export const CBTE_TIPO_BY_INVOICE_TYPE: Record<InvoiceType, number> = {
  A: 1,
  B: 6,
  C: 11,
  E: 19,
  M: 51,
} as const;

/** DocType AFIP */
export const AFIP_DOC_TYPE = {
  CUIT: 80,
  CUIL: 86,
  CDI: 87,
  CONSUMIDOR_FINAL: 99,
} as const;

/** Moneda: 1 = Peso argentino */
export const AFIP_MONEDA_PESOS = 1;
