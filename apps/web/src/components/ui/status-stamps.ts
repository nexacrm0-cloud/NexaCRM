import type { StampTone } from '@/components/ui/stamp';

export const QUOTE_STATUS_LIST: Array<{
  key: string;
  label: string;
  tone: StampTone;
  stamp: string;
}> = [
  { key: 'DRAFT', label: 'Borrador', tone: 'mute', stamp: 'BORRADOR' },
  { key: 'SENT', label: 'Enviado', tone: 'cobalt', stamp: 'ENVIADO' },
  { key: 'ACCEPTED', label: 'Aceptado', tone: 'naranja', stamp: 'ACEPTADO' },
  { key: 'REJECTED', label: 'Rechazado', tone: 'alizarin', stamp: 'RECHAZADO' },
  { key: 'EXPIRED', label: 'Vencido', tone: 'mute', stamp: 'VENCIDO' },
];

export const INVOICE_STATUS_LIST: Array<{
  key: string;
  label: string;
  tone: StampTone;
  stamp: string;
}> = [
  { key: 'DRAFT', label: 'Borrador', tone: 'mute', stamp: 'BORRADOR' },
  { key: 'ISSUED', label: 'Emitida', tone: 'cobalt', stamp: 'EMITIDA' },
  { key: 'PARTIALLY_PAID', label: 'Parcial', tone: 'naranja', stamp: 'PARCIAL' },
  { key: 'PAID', label: 'Pagada', tone: 'verde', stamp: 'PAGADA' },
  { key: 'OVERDUE', label: 'Vencida', tone: 'alizarin', stamp: 'VENCIDA' },
  { key: 'CANCELLED', label: 'Anulada', tone: 'mute', stamp: 'ANULADA' },
];

export const DEAL_STATUS_LIST: Array<{
  key: string;
  label: string;
  tone: StampTone;
  stamp: string;
}> = [
  { key: 'OPEN', label: 'Abierto', tone: 'cobalt', stamp: 'ABIERTO' },
  { key: 'WON', label: 'Ganado', tone: 'verde', stamp: 'GANADO' },
  { key: 'LOST', label: 'Perdido', tone: 'alizarin', stamp: 'PERDIDO' },
];

export const TASK_STATUS_LIST: Array<{
  key: string;
  label: string;
  tone: StampTone;
  stamp: string;
}> = [
  { key: 'TODO', label: 'Pendiente', tone: 'mute', stamp: 'PENDIENTE' },
  { key: 'PENDING', label: 'Pendiente', tone: 'mute', stamp: 'PENDIENTE' },
  { key: 'IN_PROGRESS', label: 'En curso', tone: 'cobalt', stamp: 'EN CURSO' },
  { key: 'DONE', label: 'Hecha', tone: 'verde', stamp: 'HECHA' },
  { key: 'COMPLETED', label: 'Hecha', tone: 'verde', stamp: 'HECHA' },
  { key: 'CANCELLED', label: 'Cancelada', tone: 'alizarin', stamp: 'CANCELADA' },
];

export const PRIORITY_LIST: Array<{
  key: string;
  label: string;
  tone: StampTone;
  stamp: string;
}> = [
  { key: 'LOW', label: 'Baja', tone: 'mute', stamp: 'BAJA' },
  { key: 'MEDIUM', label: 'Media', tone: 'cobalt', stamp: 'MEDIA' },
  { key: 'HIGH', label: 'Alta', tone: 'naranja', stamp: 'ALTA' },
  { key: 'URGENT', label: 'Urgente', tone: 'alizarin', stamp: 'URGENTE' },
];

export function lookupStatus(
  list: Array<{ key: string; tone: StampTone; stamp: string }>,
  key: string,
): { tone: StampTone; stamp: string } {
  return list.find((s) => s.key === key) ?? { tone: 'mute' as StampTone, stamp: key };
}
