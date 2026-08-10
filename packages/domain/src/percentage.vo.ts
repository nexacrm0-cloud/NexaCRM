export class Percentage {
  private constructor(readonly value: number) {}

  static create(value: number): Percentage {
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid percentage value: ${value}`);
    }
    if (value < 0 || value > 100) {
      throw new Error(`Percentage must be between 0 and 100: ${value}`);
    }
    return new Percentage(value);
  }

  equals(other: Percentage): boolean {
    return this.value === other.value;
  }

  toDecimal(): number {
    return this.value / 100;
  }

  applyTo(base: number): number {
    return base * this.toDecimal();
  }
}
