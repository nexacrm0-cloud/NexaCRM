import { BadRequestException } from '@nestjs/common';

/**
 * Field-level allowlist projection for list/detail endpoints.
 *
 * Several models carry columns that must never leak into an API response
 * (password hashes, refresh tokens, 2FA secrets, internal flags). The
 * @nexa/api controllers historically relied on each service remembering to
 * write an explicit `select:` in every Prisma call — which is brittle: a
 * new nullable column added to the schema defaults to "returned" unless
 * someone updates every call site.
 *
 * This helper takes a client-supplied `?select=` query string (comma-
 * separated field names from the SPA), validates it against a per-model
 * allowlist, and returns a Prisma `select` object that:
 *
 *   1. only ever exposes fields that are on the allowlist,
 *   2. ALWAYS excludes the denylist below, even if the caller explicitly
 *      names them (defense-in-depth against a future allowlist drift),
 *   3. returns `undefined` when the client didn't ask for anything, so
 *      callers can fall back to their existing `include`-based shape.
 *
 * The denylist is intentionally a single hard-coded Set (not configurable)
 * so there's no way to opt a sensitive field back in via a typo.
 */

// Fields that must NEVER appear in any API response. Hard-coded. Adding a
// new sensitive column means adding it here, period.
const SENSITIVE_FIELDS: ReadonlySet<string> = new Set([
  'passwordHash',
  'refreshToken',
  'twoFactorSecret',
  'isTwoFactorEnabled',
  'emailVerifiedAt',
  'apiKey', // agent subscription keys — has its own regenerate endpoint
  'password',
  'secret',
  'token',
  'apiSecret',
  'accessToken',
  'refreshToken',
  'config', // connectors.config holds third-party credentials in plaintext
  'webhookSecret',
  'mpWebhookSecret',
  'stripeWebhookSecret',
]);

type FieldAllowlist = ReadonlySet<string>;

export function buildSelect(
  rawSelect: string | string[] | undefined,
  allowlist: FieldAllowlist,
  options: { maxFields?: number } = {},
): Record<string, true> | undefined {
  const { maxFields = 30 } = options;

  if (!rawSelect) return undefined;

  // supertest / express may pass an array (?select=a&select=b) or a single
  // comma-separated string (?select=a,b,c). Normalize to a list.
  const raw = Array.isArray(rawSelect) ? rawSelect.join(',') : String(rawSelect);
  const requested = raw
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);

  if (requested.length === 0) return undefined;
  if (requested.length > maxFields) {
    throw new BadRequestException(
      `?select= admite hasta ${maxFields} campos (recibidos ${requested.length})`,
    );
  }

  // Reject anything not on the allowlist up front — we don't silently drop
  // unknown fields because that hides bugs in the SPA (a renamed column
  // would silently disappear from responses) and would let a caller probe
  // the schema by watching which fields come back.
  const unknown = requested.filter((f) => !allowlist.has(f));
  if (unknown.length > 0) {
    throw new BadRequestException({
      message: 'Campos no permitidos en ?select=',
      fields: unknown,
      allowed: Array.from(allowlist).sort(),
    });
  }

  // Belt-and-suspenders: even if the allowlist above ever drifts and a
  // sensitive field slips in, the denylist below is a hard stop. This is
  // the only place that can ever return `select` to Prisma, so blocking
  // here is sufficient.
  const leaked = requested.filter((f) => SENSITIVE_FIELDS.has(f));
  if (leaked.length > 0) {
    // Don't echo the field names back — they're sensitive, so just refuse.
    throw new BadRequestException('Uno o más campos solicitados no son legibles.');
  }

  const select: Record<string, true> = {};
  for (const f of requested) select[f] = true;
  return select;
}

// ---- Per-model allowlists ---------------------------------------------------
// These mirror the fields that are legitimately useful to the SPA. Each
// list is exported so controllers/services can both validate against it
// and pass it to Prisma `select` when building queries.

export const USER_SELECTABLE_FIELDS: FieldAllowlist = new Set([
  'id',
  'email',
  'firstName',
  'lastName',
  'avatarUrl',
  'phone',
  'role',
  'organizationId',
  'isActive',
  'lastLoginAt',
  'createdAt',
  'updatedAt',
]);

export const CLIENT_SELECTABLE_FIELDS: FieldAllowlist = new Set([
  'id',
  'companyName',
  'contactName',
  'email',
  'phone',
  'address',
  'tags',
  'notes',
  'createdAt',
  'updatedAt',
  'organizationId',
]);
