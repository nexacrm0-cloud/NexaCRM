const PHONE_REGEX = /^\+?[\d\s\-().]{7,20}$/;

export class Phone {
  private constructor(readonly value: string) {}

  static create(value: string): Phone {
    const cleaned = value.trim();
    if (!PHONE_REGEX.test(cleaned)) {
      throw new Error(`Invalid phone format: "${value}"`);
    }
    return new Phone(cleaned);
  }

  equals(other: Phone): boolean {
    return this.value === other.value;
  }
}
