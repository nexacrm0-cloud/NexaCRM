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
    // Never send PII to Sentry — we use our own redactPII module
    // for application logs and don't want Sentry mirroring user
    // IPs, cookies, or auth headers into their platform.
    sendDefaultPii: false,
    integrations: [Sentry.httpIntegration(), Sentry.expressIntegration()],
    beforeSend(event) {
      if (process.env.NODE_ENV !== 'production') return null;
      // Scrub any request data that may have slipped through before transport.
      if (event.request) {
        if (event.request.cookies) {
          event.request.cookies = '[REDACTED]';
        }
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
        if (event.request.data) {
          event.request.data = '[REDACTED]';
        }
      }
      return event;
    },
  });

  return true;
})();

export function isSentryEnabled(): boolean {
  return isInitialized;
}

export { Sentry };
