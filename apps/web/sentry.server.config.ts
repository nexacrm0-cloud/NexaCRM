import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;

if (!dsn && process.env.NODE_ENV === 'production') {
  console.warn('Sentry server: SENTRY_DSN no seteado. Errores del SSR no trackeados.');
}

Sentry.init({
  dsn,
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  environment: process.env.NODE_ENV || 'development',
  release: process.env.SENTRY_RELEASE,
  // Never send PII to Sentry — headers like cookies/CSRF tokens and
  // request bodies must not be forwarded to the Sentry platform.
  sendDefaultPii: false,
  // httpIntegration was removed in @sentry/nextjs v9 — the HTTP integration
  // is now built into the core SDK and no longer needs to be registered
  // explicitly.
  beforeSend(event) {
    if (process.env.NODE_ENV !== 'production') return null;
    if (event.request) {
      if (event.request.cookies) event.request.cookies = { '[REDACTED]': '[REDACTED]' };
      if (event.request.headers) {
        const safeHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(event.request.headers)) {
          if (
            k.toLowerCase() === 'cookie' ||
            k.toLowerCase() === 'authorization' ||
            k.toLowerCase() === 'x-csrf-token' ||
            k.toLowerCase() === 'x-api-key'
          ) {
            safeHeaders[k] = '[REDACTED]';
          } else {
            safeHeaders[k] = v as string;
          }
        }
        event.request.headers = safeHeaders;
      }
      if (event.request.data) event.request.data = '[REDACTED]';
    }
    return event;
  },
});
