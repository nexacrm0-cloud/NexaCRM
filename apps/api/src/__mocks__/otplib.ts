export function generateSecret(): string {
  return 'test-secret';
}

export function generateURI(opts: { issuer: string; label: string; secret: string }): string {
  return `otpauth://totp/${opts.issuer}:${opts.label}?secret=${opts.secret}&issuer=${opts.issuer}`;
}

export function verify(opts: { token: string; secret: string }): { valid: boolean } {
  return { valid: opts.token === '123456' };
}
