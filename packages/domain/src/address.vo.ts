export class Address {
  private constructor(
    readonly street: string,
    readonly city: string,
    readonly state: string,
    readonly zipCode: string,
    readonly country: string,
  ) {}

  static create(params: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  }): Address {
    if (!params.street.trim()) throw new Error('Street is required');
    if (!params.city.trim()) throw new Error('City is required');
    if (!params.country.trim()) throw new Error('Country is required');
    return new Address(
      params.street.trim(),
      params.city.trim(),
      params.state.trim(),
      params.zipCode.trim(),
      params.country.trim(),
    );
  }

  equals(other: Address): boolean {
    return (
      this.street === other.street &&
      this.city === other.city &&
      this.state === other.state &&
      this.zipCode === other.zipCode &&
      this.country === other.country
    );
  }

  toString(): string {
    return `${this.street}, ${this.city}, ${this.state} ${this.zipCode}, ${this.country}`;
  }
}
