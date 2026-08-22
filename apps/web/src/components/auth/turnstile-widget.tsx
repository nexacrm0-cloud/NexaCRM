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
 * API directly.
 *
 * The component:
 *   - Injects the official script tag on mount if not already present.
 *   - Waits for both the script to load AND the container ref to be
 *     attached before calling window.turnstile.render(). This fixes a
 *     race where the script's onload fires before React has committed
 *     the container div to the DOM.
 *   - Surfaces render-state to the user (visible message instead of
 *     failing silently) so a missing site key or failed load is obvious.
 *   - Cleans up the widget instance on unmount.
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

    function tryRender() {
      if (cancelled) return;
      if (!containerRef.current) {
        // Container not attached yet — wait one frame and retry.
        requestAnimationFrame(tryRender);
        return;
      }
      if (!window.turnstile) {
        // Script not loaded yet — wait for the load event and retry.
        return;
      }
      try {
        // Avoid double-rendering the same container.
        if (widgetIdRef.current) return;
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

    setStatus('loading');

    if (window.turnstile) {
      // Script already loaded (e.g. another instance rendered earlier).
      tryRender();
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
    }

    const existing = document.querySelector(
      `script[src="${SCRIPT_SRC}"]`,
    ) as HTMLScriptElement | null;

    const onScriptLoad = () => {
      // Cloudflare attaches window.turnstile when api.js evaluates.
      tryRender();
    };

    if (existing) {
      if ((existing as any).dataset.loaded === 'true') {
        onScriptLoad();
      } else {
        existing.addEventListener('load', onScriptLoad, { once: true });
        existing.addEventListener(
          'error',
          () => {
            setStatus('error');
            setErrorMsg('No se pudo cargar el script de Turnstile (network/CSP)');
          },
          { once: true },
        );
      }
    } else {
      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        (script as any).dataset.loaded = 'true';
        onScriptLoad();
      };
      script.onerror = () => {
        setStatus('error');
        setErrorMsg('No se pudo cargar el script de Turnstile (network/CSP)');
      };
      document.head.appendChild(script);
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
      <div ref={containerRef} className="min-h-[65px] w-full" />
      {status === 'loading' && (
        <div className="eyebrow text-ink-3">Cargando CAPTCHA…</div>
      )}
    </div>
  );
}
