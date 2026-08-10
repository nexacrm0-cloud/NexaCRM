const { withSentryConfig } = require('@sentry/nextjs');

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
    // In dev, Next.js (webpack/react-refresh) requires 'unsafe-eval' and allows inline styles/scripts.
    // In production we keep the stricter policy (no unsafe-eval, only 'self' scripts).
    // connect-src includes Sentry ingest domain so the browser can report errors.
    const sentryHost = process.env.NEXT_PUBLIC_SENTRY_HOST || 'sentry.io';
    const cspValue = isDev
      ? `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://avatars.githubusercontent.com http://localhost; connect-src 'self' http://localhost:4000 https://*.githubusercontent.com https://${sentryHost}; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';`
      : `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://avatars.githubusercontent.com http://localhost; connect-src 'self' http://localhost:4000 https://*.githubusercontent.com https://${sentryHost}; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';`;
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
          { key: 'Content-Security-Policy', value: cspValue },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL || 'http://localhost:4000'}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${process.env.API_URL || 'http://localhost:4000'}/uploads/:path*`,
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
