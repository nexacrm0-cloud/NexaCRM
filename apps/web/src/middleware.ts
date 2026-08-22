import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import crypto from 'crypto';

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/accept-invitation',
  '/forgot-password',
  '/reset-password',
  '/two-factor',
  '/pricing',
  '/automation/pro',
  '/automatizaciones/pro',
];

// SECURITY D3: per-request nonce for CSP. The middleware generates it,
// attaches it to the request so server components can read it via
// `headers().get('x-nonce')`, and embeds it in the CSP header that the
// browser enforces. A nonce-based CSP is strictly stronger than
// 'unsafe-inline' — every inline <script>/<style> must explicitly carry
// the nonce attribute or the browser refuses to execute it.
function generateNonce(): string {
  // 128 bits is enough entropy to make guessing impractical while staying a
  // reasonable size for the CSP header.
  return crypto.randomBytes(16).toString('base64');
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';
  const sentryHost = process.env.NEXT_PUBLIC_SENTRY_HOST || 'sentry.io';
  // Hardcoded here (and not imported from next.config.js) because
  // next.config.js's `headers()` callback runs at build time, not per
  // request, so we cannot reuse its builder function here.
  const apiOrigin = (() => {
    const defaultApiBase =
      process.env.NODE_ENV === 'production'
        ? 'https://nexa-api-unv3.onrender.com'
        : 'http://localhost:4000';
    return new URL(process.env.API_URL || defaultApiBase).origin;
  })();
  const turnstileHosts =
    'https://challenges.cloudflare.com https://*.turnstile.cloudflare.com';
  if (isDev) {
    return [
      `default-src 'self'`,
      `script-src 'self' 'unsafe-eval' 'unsafe-inline' ${turnstileHosts}`,
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' data: blob: https://avatars.githubusercontent.com http://localhost`,
      `connect-src 'self' ${apiOrigin} https://*.githubusercontent.com https://${sentryHost} ${turnstileHosts}`,
      `font-src 'self'`,
      `object-src 'none'`,
      `frame-ancestors 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
      `frame-src 'self' ${turnstileHosts}`,
    ].join('; ');
  }
  // Production: nonce-locked script-src, no 'unsafe-inline' for scripts.
  // style-src keeps 'unsafe-inline' because Next.js still emits some
  // critical CSS without nonces for SSR'd pages; locking it would
  // require touching every styled element in the app.
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' ${turnstileHosts}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://avatars.githubusercontent.com http://localhost`,
    `connect-src 'self' ${apiOrigin} https://*.githubusercontent.com https://${sentryHost} ${turnstileHosts}`,
    `font-src 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-src 'self' ${turnstileHosts}`,
  ].join('; ');
}

export function middleware(request: NextRequest) {
  const nonce = generateNonce();

  // Clone request headers and attach the nonce so server components rendered
  // downstream can read it via `headers().get('x-nonce')`.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // SECURITY D3: emit the CSP with the per-request nonce. This replaces the
  // static CSP set by next.config.js for any response that flows through
  // the middleware (i.e. everything except static assets).
  response.headers.set('content-security-policy', buildCsp(nonce));
  response.headers.set('x-nonce', nonce);

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith('/api/'));
  const refreshCookie =
    request.cookies.get('__Host-refresh_token')?.value ||
    request.cookies.get('refresh_token')?.value;

  if (!refreshCookie && !isPublic) {
    // Auth gating happens client-side; we still need the nonce on the response.
    return response;
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'],
};
