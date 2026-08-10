/* eslint-disable no-control-regex */
const CONTROL_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function sanitizeString(value: string, maxLength?: number): string {
  let s = value.replace(CONTROL_CHARS, '');
  s = s.trim();
  if (maxLength !== undefined && s.length > maxLength) {
    s = s.slice(0, maxLength);
  }
  return s;
}

export function isEmailLike(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_RE.test(value);
}

export function looksLikeEmailKey(key: string): boolean {
  return /email|correo/i.test(key);
}

export type SanitizeOptions = {
  arrayDepth?: number;
};

export function sanitizeInput<T>(value: T, options: SanitizeOptions = {}): T {
  const { arrayDepth = 3 } = options;

  function walk(v: unknown, depth: number, parentKey?: string): unknown {
    if (v === null || v === undefined) return v;

    if (typeof v === 'string') {
      const trimmed = sanitizeString(v);
      if (parentKey && looksLikeEmailKey(parentKey) && EMAIL_RE.test(trimmed)) {
        return normalizeEmail(trimmed);
      }
      return trimmed;
    }

    if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') {
      return v;
    }

    if (Array.isArray(v)) {
      if (depth <= 0) return [];
      return v.map((item) => walk(item, depth - 1));
    }

    if (typeof v === 'object') {
      if (depth <= 0) return {};
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        out[k] = walk(val, depth - 1, k);
      }
      return out;
    }

    return v;
  }

  return walk(value, arrayDepth + 1) as T;
}
