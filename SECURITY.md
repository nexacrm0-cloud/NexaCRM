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

---

## Secret rotation procedures (operational)

### Cadence: every 90 days (or immediately upon suspected compromise)

| Secret | Location | Rotation steps | Validation |
|--------|----------|----------------|------------|
| `JWT_SECRET` | Render API env vars | 1. Generate new 64-char random string (`openssl rand -base64 48`)<br>2. Add as `JWT_SECRET_NEW` in Render<br>3. Deploy with dual-verify: accept both old + new for 1 release<br>4. Remove old, rename new to `JWT_SECRET` | `pnpm test` + manual login/logout flow |
| `JWT_REFRESH_SECRET` | Render API env vars | Same as `JWT_SECRET` | Same |
| `JWT_2FA_PENDING_SECRET` | Render API env vars | Same as `JWT_SECRET` | Same + 2FA complete-login test |
| `MP_ACCESS_TOKEN` | Render API env vars | 1. In Mercado Pago dashboard → Credentials → Rotate access token<br>2. Update Render env var<br>3. Redeploy API | Test a checkout flow end-to-end |
| `MP_WEBHOOK_SECRET` | Render API env vars | 1. In MP dashboard → Webhooks → Regenerate secret<br>2. Update Render env var<br>3. Redeploy API | Trigger test webhook (MP dashboard "Send test") |
| `WHATSAPP_APP_SECRET` | Render API env vars | 1. In Meta Business Manager → WhatsApp → Settings → App Secret → Reset<br>2. Update Render env var<br>3. Redeploy API | Send test message from WhatsApp sandbox |
| `WHATSAPP_VERIFY_TOKEN` | Render API + Web env vars | 1. Generate new 32-char random string<br>2. Update both API + Web env vars<br>3. Redeploy both | Webhook verification test in Meta dashboard |
| `SENTRY_DSN` | Render API + Web env vars | 1. In Sentry → Project Settings → Client Keys (DSN) → Regenerate<br>2. Update both env vars<br>3. Redeploy both | Trigger test error, verify in Sentry |
| `TURNSTILE_SECRET_KEY` | Render API env vars | 1. In Cloudflare Turnstile → Site → Secret Key → Regenerate<br>2. Update API env var<br>3. Redeploy API | Login with CAPTCHA, verify challenge passes |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Render Web env vars | 1. Same Cloudflare site → Site Key (public, no rotation needed unless domain changes) | Widget loads on `/login` |
| Database credentials | Render Postgres | 1. Render Dashboard → Database → Credentials → Rotate<br>2. Update `DATABASE_URL` in API env vars<br>3. Redeploy API | `pnpm test` passes, app boots |
| `AFIP_CERT_PATH` / `AFIP_KEY_PATH` | Render API (mounted secret files) | 1. Generate new AFIP cert/key pair in AFIP homologation<br>2. Upload new files to Render secret files<br>3. Update paths if changed<br>4. Redeploy API | Emit test invoice in homologation, verify CAE |

### Backup encryption (Render-managed)

- Render Postgres: automated daily backups, encrypted at rest (AES-256), retained 7 days (configurable up to 30 on paid plans).
- Point-in-time recovery: available via Render dashboard.
- No additional app-level backup encryption needed — Render handles it.

### Incident response rotation (emergency)

If any secret is suspected compromised:
1. **Immediately** rotate that secret using the procedure above.
2. Invalidate all active sessions: truncate `refresh_tokens` table or add a `revoked_at` column and filter in `AuthService.refresh()`.
3. Force re-login: deploy with a new `JWT_SECRET` (users auto-logged out).
4. Audit logs: check Sentry + DB audit log for anomalous access patterns in the last 24h.
5. Notify stakeholders per internal runbook.

---

## D3 — CSP nonce migration roadmap (post-beta sprint)

### Current state (D3 spike applied)
- `apps/web/src/middleware.ts` generates a per-request nonce (128-bit base64) and emits it in the `Content-Security-Policy` header as `script-src 'nonce-XXX'`.
- Fallback in `apps/web/next.config.js` still has `'unsafe-inline'` for assets that bypass middleware (rare).
- **Known gap**: Next.js 14 emits inline hydration scripts (`__next_f.push(...)`) that don't carry the nonce, so we MUST keep `'unsafe-inline'` in production for now.

### Blocker: Next.js 14 limitation
Next.js 14 does NOT support automatic nonce propagation to hydration scripts. The CSP spec forbids combining nonce + `unsafe-inline` (the latter is ignored when a nonce is present). We tried a nonce-only CSP in D3 spike and it broke hydration.

### Proper fix: D1 (Next.js 15 upgrade)
Next.js 15 supports **native nonce propagation** via the `Script` component's `nonce` prop and the new `cspNonce` config. Once D1 is merged (Next 14→15 + Sentry 9), we can:

1. Remove `'unsafe-inline'` from `script-src` in `next.config.js`.
2. Update `middleware.ts` to emit only `script-src 'nonce-XXX'`.
3. Replace any remaining manual `<script>` tags with `<Script nonce={nonce}>` in page components.
4. Verify hydration works on all pages.

### Migration checklist (for the sprint after D1 merge)

- [ ] D1 (Next.js 15 + Sentry 9) merged and validated in production.
- [ ] Remove `'unsafe-inline'` from `script-src` in `apps/web/next.config.js` (keep only `'nonce-XXX'`).
- [ ] Remove `'unsafe-inline'` from `style-src` if Next 15 supports CSS nonce (or document remaining gap).
- [ ] Update `apps/web/src/middleware.ts` to emit strict CSP without fallback `unsafe-inline`.
- [ ] Audit all components for inline `<script>` / `<style>` — replace with `Script`/`Style` components from `next/script` with `nonce` prop.
- [ ] Test hydration on: `/login`, `/register`, `/dashboard`, `/automatizaciones/pro`, `/clients`, `/invoices`.
- [ ] Verify Turnstile CAPTCHA widget still loads (needs `script-src 'nonce-XXX' 'unsafe-inline'` for Cloudflare's inline script OR migrate to external script).
- [ ] Run `pnpm test` + manual QA pass.
- [ ] Update `SECURITY.md` threat model: CSP nonce = ✅.

### Estimated effort
2-3 days of focused work after D1 is stable in production.

### Why this is the highest-impact remaining security improvement
Removing `'unsafe-inline'` closes the last major XSS vector: if an attacker finds any injection point (even in a component we thought safe), they can't execute script without the per-request nonce. This is defense-in-depth at the browser level.
