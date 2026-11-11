function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://nexa-api-unv3.onrender.com/api/v1'
    : 'http://localhost:4000/api/v1');

class ApiClient {
  private baseUrl: string;
  // SECURITY H3: the access token is held ONLY in memory. We no longer
  // mirror it to sessionStorage or a non-HttpOnly cookie, so an XSS payload
  // cannot simply read `sessionStorage.access_token` to exfiltrate the
  // session. After a page reload, the SPA silently calls /auth/refresh
  // (cookie-based, HttpOnly) to repopulate this field.
  private accessToken: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;
  private sessionExpiredCallbacks: Array<() => void> = [];

  constructor() {
    this.baseUrl = API_BASE;
    // No persistence read on the client: a missing in-memory token simply
    // triggers a refresh on the first authenticated call.
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
    // SECURITY: do NOT persist. Keeping the token reachable by JS defeats
    // the XSS hardening entirely; the httpOnly refresh cookie is the only
    // long-lived credential.
  }

  onSessionExpired(cb: () => void) {
    this.sessionExpiredCallbacks.push(cb);
    return () => {
      this.sessionExpiredCallbacks = this.sessionExpiredCallbacks.filter((c) => c !== cb);
    };
  }

  /**
   * Notifies the app that the session is gone and remembers WHY, so the
   * login screen can explain it (e.g. "tu demo de 7 días ya terminó")
   * instead of dropping the prospect on a blank login form.
   */
  private notifySessionExpired(reason?: string) {
    if (reason && typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem('session_expired_reason', reason);
      } catch {
        // ignore storage failures
      }
    }
    this.sessionExpiredCallbacks.forEach((cb) => cb());
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }
    const csrfToken = getCookie('csrf-token');
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    const supportOrgId =
      typeof window !== 'undefined' ? sessionStorage.getItem('support_org_id') : null;
    if (supportOrgId) {
      headers['x-support-org-id'] = supportOrgId;
    }

    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (options.headers) {
      Object.assign(headers, options.headers);
    }

    const config: RequestInit = {
      credentials: 'include',
      ...options,
      headers,
    };

    const response = await fetch(url, config);
    const data = await response.json();

    if (response.status === 401 || response.status === 403) {
      // 401 = JWT expirado. 403 = CSRF cookie inválido o token sin permisos.
      // Ambos son session inválida → limpiar + redirigir a login.
      if (endpoint === '/auth/login' || endpoint === '/auth/register') {
        throw new Error(data.error?.message || 'Credenciales inválidas');
      }
      // CSRF failure sin cookie: parece que la sesión está toda rota. Forzar re-login.
      if (response.status === 403 && !getCookie('csrf-token')) {
        this.setAccessToken(null);
        this.notifySessionExpired('CSRF token ausente. Reabri sesión.');
        throw new Error('CSRF token ausente. Reabri sesión.');
      }
      // 401: intentar refresh una vez.
      if (response.status === 401) {
        const refreshed = await this.refreshToken();
        if (refreshed && this.accessToken) {
          // The token issued by the refresh MUST be added to the retried
          // request. `config.headers` was built BEFORE the refresh (without
          // an Authorization header), so reusing `config` as-is would retry
          // the request still without credentials → 401 again → the session
          // would be dropped on every page reload.
          const retryConfig: RequestInit = {
            ...config,
            headers: { ...headers, Authorization: `Bearer ${this.accessToken}` },
          };
          const retryResponse = await fetch(url, retryConfig);
          const retryData = await retryResponse.json();
          if (!retryResponse.ok)
            throw new Error(retryData.error?.message || 'Error en la solicitud');
          return retryData;
        }
      }
      this.notifySessionExpired(data.error?.message);
      throw new Error(data.error?.message || 'Sesión expirada');
    }

    if (!response.ok) {
      throw new Error(data.error?.message || `Error ${response.status}`);
    }

    return data;
  }

  private async refreshToken(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    this.refreshPromise = this._refresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async _refresh(): Promise<boolean> {
    try {
      const refreshHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      const csrfToken = getCookie('csrf-token');
      if (csrfToken) {
        refreshHeaders['X-CSRF-Token'] = csrfToken;
      }
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: refreshHeaders,
      });
      if (response.ok) {
        const body = await response.json();
        if (body?.data?.accessToken) {
          this.setAccessToken(body.data.accessToken);
        }
        return true;
      }
      this.setAccessToken(null);
      return false;
    } catch {
      this.setAccessToken(null);
      return false;
    }
  }

  async get<T>(endpoint: string, params?: Record<string, string | number | undefined>): Promise<T> {
    let url = endpoint;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.set(key, String(value));
        }
      });
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
    }
    return this.request<T>(url);
  }

  async post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    const isFormData = body instanceof FormData;
    return this.request<T>(endpoint, {
      method: 'POST',
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
      ...options,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...((options?.headers as Record<string, string>) || {}),
      },
    });
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
