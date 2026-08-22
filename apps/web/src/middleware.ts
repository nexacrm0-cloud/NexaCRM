import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// SECURITY D3: Web Crypto (available in Edge runtime) — `node:crypto` is
// not, so we use `crypto.getRandomValues` instead of `crypto.randomBytes`.
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary);
}

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
  const turnstileHosts = 'https://challenges.cloudflare.com https://*.turnstile.cloudflare.com';
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
