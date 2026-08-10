const VALID_CURRENCIES = ['USD', 'EUR', 'MXN', 'COP', 'ARS', 'CLP', 'PEN'] as const;
export type Currency = (typeof VALID_CURRENCIES)[number];

export class Money {
  private constructor(
    readonly amount: number,
    readonly currency: Currency,
  ) {}

  static create(amount: number, currency: string = 'USD'): Money {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error(`Invalid money amount: ${amount}`);
    }
    const upper = currency.toUpperCase();
    if (!VALID_CURRENCIES.includes(upper as Currency)) {
      throw new Error(`Unsupported currency: "${currency}"`);
    }
    return new Money(amount, upper as Currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add money with different currencies');
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(this.amount * factor, this.currency);
  }

  toNumber(): number {
    return this.amount;
  }
}
