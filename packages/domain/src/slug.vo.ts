const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class Slug {
  private constructor(readonly value: string) {}

  static create(value: string): Slug {
    const slug = value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!slug || !SLUG_REGEX.test(slug)) {
      throw new Error(`Cannot create valid slug from: "${value}"`);
    }
    return new Slug(slug);
  }

  equals(other: Slug): boolean {
    return this.value === other.value;
  }
}
