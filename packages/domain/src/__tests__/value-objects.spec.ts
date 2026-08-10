import { Email, Phone, Money, Address, Slug, Percentage } from '../index';

describe('Email', () => {
  it('should create a valid email', () => {
    const email = Email.create('Test@Example.com');
    expect(email.value).toBe('test@example.com');
  });

  it('should throw for invalid email', () => {
    expect(() => Email.create('not-an-email')).toThrow('Invalid email format');
    expect(() => Email.create('')).toThrow('Invalid email format');
    expect(() => Email.create('@domain.com')).toThrow('Invalid email format');
  });

  it('should compare equality', () => {
    const a = Email.create('user@test.com');
    const b = Email.create('user@test.com');
    const c = Email.create('other@test.com');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

describe('Phone', () => {
  it('should create a valid phone', () => {
    const phone = Phone.create('+1 (555) 123-4567');
    expect(phone.value).toBe('+1 (555) 123-4567');
  });

  it('should throw for invalid phone', () => {
    expect(() => Phone.create('')).toThrow('Invalid phone format');
    expect(() => Phone.create('ab')).toThrow('Invalid phone format');
  });

  it('should compare equality', () => {
    const a = Phone.create('+521234567890');
    const b = Phone.create('+521234567890');
    const c = Phone.create('+525551234567');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

describe('Money', () => {
  it('should create valid money', () => {
    const m = Money.create(100.5, 'USD');
    expect(m.amount).toBe(100.5);
    expect(m.currency).toBe('USD');
  });

  it('should default to USD', () => {
    const m = Money.create(50);
    expect(m.currency).toBe('USD');
  });

  it('should throw for negative amount', () => {
    expect(() => Money.create(-10)).toThrow('Invalid money amount');
  });

  it('should throw for unsupported currency', () => {
    expect(() => Money.create(100, 'JPY')).toThrow('Unsupported currency');
  });

  it('should throw when adding different currencies', () => {
    const a = Money.create(100, 'USD');
    const b = Money.create(50, 'EUR');
    expect(() => a.add(b)).toThrow('Cannot add money with different currencies');
  });

  it('should add same-currency money', () => {
    const a = Money.create(100, 'USD');
    const b = Money.create(50, 'USD');
    const result = a.add(b);
    expect(result.amount).toBe(150);
    expect(result.currency).toBe('USD');
  });

  it('should multiply', () => {
    const m = Money.create(100, 'USD');
    const result = m.multiply(2.5);
    expect(result.amount).toBe(250);
  });

  it('should compare equality', () => {
    const a = Money.create(100, 'USD');
    const b = Money.create(100, 'USD');
    const c = Money.create(200, 'USD');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

describe('Address', () => {
  it('should create a valid address', () => {
    const addr = Address.create({
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA',
    });
    expect(addr.street).toBe('123 Main St');
    expect(addr.country).toBe('USA');
  });

  it('should throw when street is empty', () => {
    expect(() =>
      Address.create({ street: '', city: 'NYC', state: 'NY', zipCode: '10001', country: 'USA' }),
    ).toThrow('Street is required');
  });

  it('should throw when city is empty', () => {
    expect(() =>
      Address.create({
        street: '123 Main',
        city: '',
        state: 'NY',
        zipCode: '10001',
        country: 'USA',
      }),
    ).toThrow('City is required');
  });

  it('should throw when country is empty', () => {
    expect(() =>
      Address.create({
        street: '123 Main',
        city: 'NYC',
        state: 'NY',
        zipCode: '10001',
        country: '',
      }),
    ).toThrow('Country is required');
  });

  it('should format toString correctly', () => {
    const addr = Address.create({
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA',
    });
    expect(addr.toString()).toBe('123 Main St, New York, NY 10001, USA');
  });

  it('should compare equality', () => {
    const a = Address.create({
      street: '123 Main',
      city: 'NYC',
      state: 'NY',
      zipCode: '10001',
      country: 'USA',
    });
    const b = Address.create({
      street: '123 Main',
      city: 'NYC',
      state: 'NY',
      zipCode: '10001',
      country: 'USA',
    });
    const c = Address.create({
      street: '456 Oak',
      city: 'NYC',
      state: 'NY',
      zipCode: '10001',
      country: 'USA',
    });
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

describe('Slug', () => {
  it('should create a valid slug', () => {
    const slug = Slug.create('Hello World');
    expect(slug.value).toBe('hello-world');
  });

  it('should handle special characters', () => {
    const slug = Slug.create('Hello World!! & More');
    expect(slug.value).toBe('hello-world-more');
  });

  it('should collapse multiple hyphens and trim edges', () => {
    const slug = Slug.create('   Hello   World   ');
    expect(slug.value).toBe('hello-world');
  });

  it('should throw for invalid slug', () => {
    expect(() => Slug.create('')).toThrow('Cannot create valid slug');
    expect(() => Slug.create('@#$%')).toThrow('Cannot create valid slug');
  });

  it('should compare equality', () => {
    const a = Slug.create('Hello World');
    const b = Slug.create('hello-world');
    const c = Slug.create('other');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});

describe('Percentage', () => {
  it('should create valid percentages', () => {
    expect(Percentage.create(0).value).toBe(0);
    expect(Percentage.create(50).value).toBe(50);
    expect(Percentage.create(100).value).toBe(100);
  });

  it('should throw for out of range', () => {
    expect(() => Percentage.create(-1)).toThrow('Percentage must be between 0 and 100');
    expect(() => Percentage.create(101)).toThrow('Percentage must be between 0 and 100');
  });

  it('should throw for non-finite values', () => {
    expect(() => Percentage.create(NaN)).toThrow('Invalid percentage value');
    expect(() => Percentage.create(Infinity)).toThrow('Invalid percentage value');
  });

  it('should convert to decimal', () => {
    expect(Percentage.create(50).toDecimal()).toBe(0.5);
    expect(Percentage.create(100).toDecimal()).toBe(1);
    expect(Percentage.create(0).toDecimal()).toBe(0);
  });

  it('should apply to a base number', () => {
    expect(Percentage.create(20).applyTo(200)).toBe(40);
    expect(Percentage.create(50).applyTo(80)).toBe(40);
    expect(Percentage.create(0).applyTo(100)).toBe(0);
  });

  it('should compare equality', () => {
    const a = Percentage.create(75);
    const b = Percentage.create(75);
    const c = Percentage.create(50);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
