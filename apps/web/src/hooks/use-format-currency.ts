'use client';

import { useOrganizationCurrency } from '@/hooks/use-organization-currency';

export function useFormatCurrency() {
  const { currency, locale } = useOrganizationCurrency();
  return (amount: number | string, overrideCurrency?: string) => {
    const resolvedCurrency = overrideCurrency ?? currency;
    const fmt = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: resolvedCurrency,
      minimumFractionDigits: 2,
    });
    const n = typeof amount === 'string' ? Number(amount) : amount;
    if (Number.isNaN(n)) return fmt.format(0);
    return fmt.format(n);
  };
}
