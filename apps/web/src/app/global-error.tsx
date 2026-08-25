'use client';

import * as Sentry from '@sentry/nextjs';
import NextError from 'next/error';
import { useEffect } from 'react';

// SECURITY: Captures uncaught errors from the App Router root layout /
// page boundary. Inside the dashboard layout.tsx this error boundary
// already has a fallback component; this one covers the root layout
// segment (before the dashboard layout mounts).
//
// Sentry automatically tracks the error metadata (digest, URL, user agent)
// on top of our own error reporting.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        {/* NextError renders a generic "Something went wrong" UI for the
            root page boundary without leaking stack traces to the DOM. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
