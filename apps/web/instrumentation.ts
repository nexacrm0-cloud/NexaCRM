import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;

if (!dsn && process.env.NODE_ENV === 'production') {
  console.warn('Sentry server: SENTRY_DSN no seteado. Errores del SSR no trackeados.');
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
