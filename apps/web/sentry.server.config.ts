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
  // httpIntegration was removed in @sentry/nextjs v9 — the HTTP integration
  // is now built into the core SDK and no longer needs to be registered
  // explicitly.
  beforeSend(event) {
    if (process.env.NODE_ENV !== 'production') return null;
    return event;
  },
});
