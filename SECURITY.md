# Security — Nexa CRM

This document tracks the security model, applied hardening, and known
technical debt. It complements `docs/security-audit-2026-08.md` (audit
report) and `docs/security-release-checklist.md` (release gates).

## Reporting a vulnerability

Email `security@nexacrm.com` (or your private channel). Please do not
file public issues for suspected vulnerabilities.

---

## Security model

Nexa CRM is a multi-tenant SaaS where each tenant (`Organization`)
owns its users, clients, deals, invoices, etc. The cardinal rule is
**no cross-tenant data access, ever.**

### Defense in depth (current state)

1. **Authentication** — bcrypt cost 12 for password hashing. Short-lived
   access JWT (15 min) + long-lived refresh JWT (24h, rotated via
   compare-and-set on a hashed column). Two-factor auth (TOTP) requires
   a separately-signed `pendingToken` so a leaked refresh secret cannot
   skip the password check.

2. **Session cookies** — `__Host-` prefix in production, `HttpOnly`,
   `Secure`, `SameSite=Strict`. `refresh_token` is **never** mirrored
   to JS-readable storage; the access token lives only in memory.

3. **CSRF** — double-submit cookie pattern. Every mutating endpoint
   requires `X-CSRF-Token` to match the `csrf-token` cookie. Webhooks
   and unauthenticated `/api/v1/auth/*` endpoints are exempt by
   design (HMAC or Zod-validated input).

4. **Tenant isolation (IDOR defense)** — every controller that accepts
   a resource ID propagates `user.organizationId` to the service, and
   the service includes it in the Prisma `where` clause. **Additionally**
   Postgres Row-Level Security (RLS) restricts every query to the row's
   `organizationId` matching the connection-level `app.organization_id`
   session var. The `TenantMiddleware` sets the var per request; the
   `RlsCleanupInterceptor` clears it after the response. Two layers,
   any one of which alone would block cross-tenant reads.

5. **Rate limiting** — global Redis-backed throttler with named buckets
   (`default`, `search`, `writes`, `agent-callback`, `agent-trigger`).
   Login has a tighter per-(IP, email) bucket via `AccountThrottlerGuard`
   plus a fail-closed Cloudflare Turnstile CAPTCHA requirement after 3
   failed attempts in a 15-min window.

6. **Input validation** — every endpoint validates input with Zod at
   the boundary via `ZodPipe`. No string concatenation into SQL; the
   only raw SQL is parameterised (RLS session-var binding, named
   Postgres sequences).

7. **Headers** — helmet on the API applies a strict CSP, HSTS
   (`max-age=31536000; preload`), `X-Frame-Options: DENY`,
   `X-Content-Type-Options: nosniff`, COOP/CORP/COEP, referrer policy,
   and `Permissions-Policy` disabling geolocation/microphone/camera.
   The Web app mirrors the same headers via `next.config.js` +
   `src/middleware.ts`.

8. **Logging hygiene** — `pii-redaction.ts` scrubs passwords, JWTs,
   bearer tokens, and card-like digit sequences from log lines,
   error responses, and stack traces before they hit the logger or
   Sentry.

9. **External integrations** —
   - **AFIP**: TLS cert + private key validated for `0600` permissions
     at boot; SDK calls, no raw HTTP.
   - **Mercado Pago**: webhook signature verified via
     `crypto.timingSafeEqual` with 5-min timestamp skew tolerance.
   - **WhatsApp**: HMAC `sha256` mandatory on webhooks, schema
     validation with `safeParse` after the signature check (so a
     malformed unsigned payload returns 401, not 400 — preventing a
     format oracle).

10. **SSRF** — every user-supplied URL flows through `validateWebhookUrl`
    (textual checks) or `validateWebhookUrlAsync` (DNS resolution +
    private-IP blocklist covering IPv4 + IPv6, loopback, link-local,
    CGNAT, AWS/GCP metadata). `axios.post()` to validated URLs always
    uses `maxRedirects: 0` so a redirect cannot pivot to an internal
    endpoint.

---

## Known technical debt

These are intentional non-disruptive trade-offs documented for the
next sprint. Tracked as items 21+ in `docs/security-audit-2026-08.md`.

### D1 — Next.js 14 → 15 upgrade (CRITICAL)

**Why**: 7 HIGH-severity advisories in Next.js 14 (SSRF in rewrites
and Server Actions, XSS via `beforeInteractive`, HTTP request smuggling,
DoS in App Router, cache poisoning). Also unblocks real nonce-based CSP.

**Why not now**: `@sentry/nextjs@8.x` does not support Next 15.
Requires upgrading Sentry to 9.x or 10.x, which is its own cascade.

**Owner**: lead dev + QA.
**Estimate**: spike 1 day + migration 2-3 days + QA 1 day.

### D2 — Multer 2.0.2 → 2.2.0+ (HIGH)

**Why**: 4 HIGH-severity DoS advisories in multer < 2.1.0 (and a
moderate one in < 2.2.0). pnpm 9 does not propagate `overrides` to
`@nestjs/platform-express@10.4.x`'s `multer@2.0.2` peer dependency.

**Why not now**: requires `@nestjs/*@11.x` (NestJS 10 is the last line
with the old multer peer dep). Same cascade as D1.

**Mitigation in place**: `file-magic-bytes` pipe + size limits on the
upload controller bound the practical DoS surface.

### D3 — CSP nonce partial revert (MEDIUM)

**Status**: production `script-src` falls back to `'unsafe-inline'`
because Next.js 14 emits unnonced hydration scripts (`__next_f.push`)
and the CSP spec forbids combining nonce + `unsafe-inline` (the latter
is ignored when a nonce is present).

**Proper fix**: D1 (Next.js 15 supports native nonce propagation).

**Why this is acceptable for now**: the bundle is served from a single
origin behind HTTPS + HSTS; the inline-script injection attack vector
requires an XSS foothold elsewhere. The other CSP directives
(`default-src 'self'`, `object-src 'none'`, `base-uri 'self'`,
`frame-ancestors 'none'`) remain strict.

### D3-pending — refresh-token rotation events (LOW)

We currently do not emit a domain event when a refresh token is
rotated. Auditing that event would let us detect stolen tokens faster
(sudden rotation from a new IP without the expected UA fingerprint).

### D4 — hard cut to 24h refresh TTL (MEDIUM, deployed)

**Impact**: users with sessions older than 24h are forced to re-login
on the next refresh attempt. Communicate to active users before each
deploy.

**Status**: deployed 2026-08-22.

### D5 — dedicated 2FA pending secret (MEDIUM, deployed)

**Why**: previously the 2FA `pendingToken` shared `JWT_REFRESH_SECRET`,
so a leaked refresh secret could forge a pending token and skip the
password check. Now signed/verified with `JWT_2FA_PENDING_SECRET`
(must be set in prod).

**Status**: deployed 2026-08-22.

### D6 — Turnstile CAPTCHA (MEDIUM, deployed)

**Why**: defense in depth beyond the ThrottlerGuard (5/min). Requires
a Cloudflare Turnstile token after 3 failed logins in 15 min.

**Status**: deployed 2026-08-22 with `CAPTCHA_THRESHOLD=999` as a
temporary override. Lower to 3 once the widget is verified end-to-end.

**Setup required in production**:

- Render Web service: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` set.
- Render API service: `TURNSTILE_SECRET_KEY` set, `CAPTCHA_THRESHOLD=3`.
- Cloudflare Turnstile dashboard: `nexa-web-c0ab.onrender.com` listed
  under Allowed Domains.

### Test coverage gaps (MEDIUM)

- E2E tests for the login flow with CAPTCHA (mocked Turnstile siteverify).
- E2E tests for IDOR (cross-tenant read attempt → expect 404).
- Load test for the AI controller throttles.
- Integration test for the RLS session-var binding.

---

## Threat model — what we explicitly defend against

| Threat                          | Defense                                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Password brute force            | bcrypt cost 12 + 5/min/IP+email throttler + 3/15-min CAPTCHA                                                                |
| Credential stuffing             | Same as above + CAPTCHA                                                                                                     |
| Stolen refresh token            | Hashed in DB, rotated compare-and-set, 24h TTL, revoked on theft detection                                                  |
| Cross-tenant data leak (IDOR)   | `user.organizationId` filter + Postgres RLS                                                                                 |
| SSRF via webhook URLs           | DNS-resolved private-IP blocklist + `maxRedirects: 0`                                                                       |
| XSS via user content            | React default escaping + CSP (script-src locked to nonce + same-origin + Cloudflare) + sanitisation on WhatsApp messageBody |
| CSRF on mutating endpoints      | Double-submit cookie + SameSite=Strict                                                                                      |
| Session fixation                | Refresh token rotation on every login                                                                                       |
| PII leak via logs               | PII redaction in error filter and logging interceptor                                                                       |
| AFIP credential theft           | `0600` permission check on cert + key at boot                                                                               |
| Webhook spoofing (MP, WhatsApp) | HMAC signature verification with `timingSafeEqual`                                                                          |
| Open redirect                   | CSP `frame-ancestors 'none'` + `form-action 'self'`                                                                         |
| Brute-force MFA bypass          | `pendingToken` requires prior password validation, signed with dedicated secret                                             |

## Threat model — known limitations

| Threat                                                   | Status                                                                      |
| -------------------------------------------------------- | --------------------------------------------------------------------------- |
| Advanced supply-chain attack via compromised npm package | Mitigated by `pnpm audit` in CI (TODO). Out of scope for the current audit. |
| Physical access to a logged-in device                    | Out of scope (browser-side).                                                |
| Insider with DB access                                   | Mitigated by RLS + audit log. Out of scope for app-level audit.             |
| DDoS at the network edge                                 | Render-level (out of scope).                                                |

---

## Reporting and incident response

For now: contact `Mateo Dumas` (`167363457+MateoDumas@users.noreply.github.com`)
via GitHub or your internal channel.

Future: implement a `SECURITY.md` GitHub banner with a PGP key.
