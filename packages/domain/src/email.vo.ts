const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private constructor(readonly value: string) {}

  static create(value: string): Email {
    if (!EMAIL_REGEX.test(value)) {
      throw new Error(`Invalid email format: "${value}"`);
    }
    const normalized = value.toLowerCase().trim();
    return new Email(normalized);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
