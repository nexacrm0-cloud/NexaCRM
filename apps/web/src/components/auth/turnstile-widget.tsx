'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: (err: unknown) => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'flexible' | 'normal' | 'compact';
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    __turnstileOnLoad?: () => void;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

/**
 * SECURITY D6: renders a Cloudflare Turnstile widget using the official
 * API directly. We use this instead of a third-party wrapper because the
 * wrapper previously failed to mount silently on this build, leaving the
 * user stuck in a 400 loop with no UI feedback.
 *
 * Behavior:
 *   - If siteKey is missing: shows a clear, visible error so the missing
 *     env var is obvious instead of failing silently.
 *   - On first mount: injects the Turnstile script (once per page load).
 *   - On unmount: removes the widget so we can re-render it on the next
 *     failure without leaking instances.
 *
 * The component surfaces render-state to the console (visible in DevTools)
 * so we can diagnose mounting issues without having to guess from a blank
 * screen.
 */
export function TurnstileWidget({
  siteKey,
  onToken,
  onError,
}: {
  siteKey?: string;
  onToken: (token: string) => void;
  onError?: (err: unknown) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'rendered' | 'error' | 'missing-key'
  >('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (!siteKey) {
      setStatus('missing-key');
      setErrorMsg('NEXT_PUBLIC_TURNSTILE_SITE_KEY no está definida en el build');
      return;
    }

    let cancelled = false;

    function renderWidget() {
      if (cancelled) return;
      if (!containerRef.current) {
        // Container not ready yet — try again next tick.
        setTimeout(renderWidget, 50);
        return;
      }
      if (!window.turnstile) {
        setStatus('error');
        setErrorMsg('turnstile global no está disponible después de cargar el script');
        return;
      }
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey!,
          callback: (token) => {
            onToken(token);
          },
          'error-callback': (err) => {
            setStatus('error');
            setErrorMsg(`Turnstile error: ${JSON.stringify(err)}`);
            if (onError) onError(err);
          },
          'expired-callback': () => {
            onToken('');
          },
          theme: 'light',
          size: 'flexible',
        });
        setStatus('rendered');
      } catch (err) {
        setStatus('error');
        setErrorMsg(
          `Turnstile.render() threw: ${err instanceof Error ? err.message : String(err)}`,
        );
        if (onError) onError(err);
      }
    }

    // Load the script if not already present.
    if (window.turnstile) {
      renderWidget();
    } else {
      setStatus('loading');
      const existing = document.querySelector(
        `script[src="${SCRIPT_SRC}"]`,
      ) as HTMLScriptElement | null;
      if (existing) {
        // Script tag exists; wait for it to finish loading if not ready.
        if ((existing as any).dataset.loaded === 'true') {
          renderWidget();
        } else {
          existing.addEventListener('load', renderWidget, { once: true });
          existing.addEventListener('error', () => {
            setStatus('error');
            setErrorMsg('No se pudo cargar el script de Turnstile');
          });
        }
      } else {
        const script = document.createElement('script');
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.onload = () => {
          (script as any).dataset.loaded = 'true';
          renderWidget();
        };
        script.onerror = () => {
          setStatus('error');
          setErrorMsg('No se pudo cargar el script de Turnstile (network/CSP)');
        };
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, onToken, onError]);

  if (status === 'missing-key') {
    return (
      <div className="border-alizarin/40 bg-alizarin/10 eyebrow text-alizarin w-full border px-3 py-2 text-center">
        CAPTCHA no configurado (NEXT_PUBLIC_TURNSTILE_SITE_KEY no está en el build).
        Contactá a soporte.
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="border-alizarin/40 bg-alizarin/10 eyebrow text-alizarin w-full border px-3 py-2 text-center">
        Error cargando CAPTCHA: {errorMsg}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={containerRef} className="min-h-[65px]" />
      {status === 'loading' && (
        <div className="eyebrow text-ink-3">Cargando CAPTCHA…</div>
      )}
    </div>
  );
}
