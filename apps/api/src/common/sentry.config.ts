import * as Sentry from '@sentry/node';

const isInitialized = (() => {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE
      ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
      : 0.1,
    profilesSampleRate: process.env.SENTRY_PROFILES_SAMPLE_RATE
      ? Number(process.env.SENTRY_PROFILES_SAMPLE_RATE)
      : 0.1,
    integrations: [Sentry.httpIntegration(), Sentry.expressIntegration()],
    beforeSend(event) {
      if (process.env.NODE_ENV !== 'production') return null;
      return event;
    },
  });

  return true;
})();

export function isSentryEnabled(): boolean {
  return isInitialized;
}

export { Sentry };
