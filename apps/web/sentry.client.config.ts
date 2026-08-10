import * as Sentry from '@sentry/nextjs';

const isServer = typeof window === 'undefined';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
  // eslint-disable-next-line no-console
  if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_SENTRY_DSN === undefined) {
    // eslint-disable-next-line no-console
    console.debug(
      'Sentry client: NEXT_PUBLIC_SENTRY_DSN no seteado. Errores del browser no trackeados.',
    );
  }
}

Sentry.init({
  dsn,
  tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  environment: process.env.NODE_ENV || 'development',
  release: process.env.SENTRY_RELEASE,
  ...(isServer ? { integrations: [Sentry.httpIntegration()] } : {}),
  beforeSend(event) {
    if (process.env.NODE_ENV !== 'production') return null;
    return event;
  },
});
