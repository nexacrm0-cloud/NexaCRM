const { withSentryConfig } = require('@sentry/nextjs');

// Fallback for when API_URL / NEXT_PUBLIC_API_URL are not injected at build
// time (Render doesn't propagate render.yaml env to pre-existing services).
// Next.js bakes these into the standalone server / client bundle at build, so
// they must resolve to the real prod API here.
const defaultApiBase =
  process.env.NODE_ENV === 'production'
    ? 'https://nexa-api-unv3.onrender.com'
    : 'http://localhost:4000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';
    // SECURITY D3: nonce-based CSP. The actual nonce is set PER REQUEST by
    // the middleware (apps/web/src/middleware.ts) on the response's
    // `content-security-policy` header. This static value is only used as
    // a fallback for any response that bypasses the middleware (rare;
    // mostly built assets). The middleware always wins for actual pages
    // because middleware runs before the response is written.
    const sentryHost = process.env.NEXT_PUBLIC_SENTRY_HOST || 'sentry.io';
    const apiOrigin = new URL(process.env.API_URL || defaultApiBase).origin;
    const turnstileHosts = [
      'https://challenges.cloudflare.com',
      'https://*.turnstile.cloudflare.com',
    ].join(' ');
    const FALLBACK_NONCE = 'static-fallback';
    const cspValue = isDev
      ? `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' ${turnstileHosts}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://avatars.githubusercontent.com http://localhost; connect-src 'self' ${apiOrigin} https://*.githubusercontent.com https://${sentryHost} ${turnstileHosts}; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; frame-src 'self' ${turnstileHosts};`
      : `default-src 'self'; script-src 'self' 'unsafe-inline' ${turnstileHosts}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://avatars.githubusercontent.com http://localhost; connect-src 'self' ${apiOrigin} https://*.githubusercontent.com https://${sentryHost} ${turnstileHosts}; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; frame-src 'self' ${turnstileHosts};`;
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
          // Cross-origin isolation: same hardening the API applies via helmet.
          // COOP isolates the browsing context (mitigates side-channel attacks),
          // CORP blocks no-cors cross-origin embeds, COEP requires explicit
          // opt-in from subresources. 'unsafe-none' on COEP because we load
          // images from avatars.githubusercontent.com and Sentry from sentry.io.
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none',
          },
          { key: 'Content-Security-Policy', value: cspValue },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL || defaultApiBase}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${process.env.API_URL || defaultApiBase}/uploads/:path*`,
      },
    ];
  },
};

module.exports = withSentryConfig(nextConfig, {
  // Solo activa cuando SENTRY_AUTH_TOKEN esta presente (en CI). En dev local
  // no haria nada y la app sigue funcionando sin telemetria.
  silent: true,
  // Deshabilitar sourcemap upload si no hay auth token
  sourcemaps: { disable: process.env.SENTRY_AUTH_TOKEN ? false : true },
  // No fallar el build si Sentry no puede alzar sourcemaps
  errorHandler: (err) => {
    if (process.env.SENTRY_AUTH_TOKEN) {
      console.error('[sentry] source upload failed:', err);
    }
  },
  // Tree-shaking en produccion: remueve Sentry SDK si no hay DSN seteado
  disableLogger: true,
});
