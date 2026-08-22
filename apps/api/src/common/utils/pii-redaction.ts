/**
 * SECURITY: PII redaction utility for server-side logging.
 *
 * Stack traces, error messages, and request payloads sometimes echo back
 * sensitive fields (passwords, JWTs, refresh tokens, cards). Before any of
 * that text hits a logger or Sentry, we run it through `redactPII` so a
 * leaked log file doesn't become a credential dump.
 *
 * The patterns here target the *shapes* credentials take on the wire inside
 * this codebase:
 *   - JSON-ish `"key":"value"` from NestJS' default validation serializer
 *   - `key=value` from query strings / form-encoded bodies
 *   - Bare `Bearer xxx` from Authorization headers
 *   - 13-19 digit sequences (PAN-style)
 *
 * This is intentionally conservative — false positives (over-redaction) are
 * fine, false negatives leak data. The function is cheap to run; call it on
 * any string before logging or shipping to a third-party observability tool.
 */
const PII_PATTERNS: Array<{ re: RegExp; replacement: string }> = [
  // JSON-ish key/value patterns
  {
    re: /("password(?:Hash|Confirm|HashConfirm)?"\s*:\s*")[^"]+(")/gi,
    replacement: '$1[REDACTED]$2',
  },
  { re: /("token"\s*:\s*")[^"]+(")/gi, replacement: '$1[REDACTED]$2' },
  { re: /("refreshToken"\s*:\s*")[^"]+(")/gi, replacement: '$1[REDACTED]$2' },
  { re: /("accessToken"\s*:\s*")[^"]+(")/gi, replacement: '$1[REDACTED]$2' },
  { re: /("authorization"\s*:\s*"Bearer\s+)[^"]+(")/gi, replacement: '$1[REDACTED]$2' },
  { re: /("apiKey"\s*:\s*")[^"]+(")/gi, replacement: '$1[REDACTED]$2' },
  { re: /("webhookSecret"\s*:\s*")[^"]+(")/gi, replacement: '$1[REDACTED]$2' },

  // Bare token forms (Authorization header value, query string token=)
  { re: /\bbearer\s+[a-zA-Z0-9._\-+/=]+/gi, replacement: 'Bearer [REDACTED]' },
  {
    re: /(\?|&)(token|access_token|refresh_token|api_key|apikey)=([^&\s]+)/gi,
    replacement: '$1$2=[REDACTED]',
  },

  // Card-like sequences: 13-19 digits with optional spaces/dashes
  { re: /\b(?:\d[ -]?){13,19}\b/g, replacement: '[REDACTED-CARD]' },
];

export function redactPII(text: string | undefined | null): string {
  if (!text) return text ?? '';
  let out = text;
  for (const { re, replacement } of PII_PATTERNS) {
    out = out.replace(re, replacement);
  }
  return out;
}

/**
 * Walk an arbitrary object/array (e.g. a Zod validation error's `errors`
 * array) and redact PII in any string leaf. Returns a structurally identical
 * object with strings scrubbed.
 */
export function redactPIIDeep<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactPII(value) as unknown as T;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((v) => redactPIIDeep(v)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = redactPIIDeep(v);
  }
  return out as unknown as T;
}
