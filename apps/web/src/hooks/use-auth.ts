'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/accept-invitation',
  '/forgot-password',
  '/reset-password',
  '/two-factor',
];

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  phone: string | null;
  role: string;
  organizationId: string;
  organizationName: string;
  organizationPlan?: string;
  isTwoFactorEnabled?: boolean;
  lastLoginAt?: string | null;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, captchaToken?: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    organizationName: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  loginWithOtp: (email: string, code: string) => Promise<void>;
  requestOtp: (
    email: string,
    purpose: 'login' | 'reset',
  ) => Promise<{ ok: boolean; cooldownMs: number | null }>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}

export function useAuthProvider() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const checkAuth = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: any }>('/auth/me');
      if (response.success) {
        const raw = response.data;
        setUser({
          ...raw,
          organizationName: raw.organization?.name ?? raw.organizationName,
          organizationPlan: raw.organization?.plan ?? raw.organizationPlan ?? 'free',
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (PUBLIC_PATHS.includes(pathname)) {
      setIsLoading(false);
      return;
    }
    checkAuth();
  }, [pathname, checkAuth]);

  const handleSessionExpired = useCallback(() => {
    setUser(null);
    setIsLoading(false);
    router.replace('/login');
  }, [router]);

  useEffect(() => {
    return api.onSessionExpired(handleSessionExpired);
  }, [handleSessionExpired]);

  const login = useCallback(
    async (email: string, password: string, captchaToken?: string) => {
      const response = await api.post<{ success: boolean; data: any }>('/auth/login', {
        email,
        password,
        // SECURITY D6: forward the Turnstile token if the widget rendered.
        // The server only requires it after N failed attempts; on a clean
        // session the field is ignored.
        ...(captchaToken ? { captchaToken } : {}),
      });
      if (response.success) {
        if (response.data.requiresTwoFactor) {
          sessionStorage.setItem('2fa_user_id', response.data.userId);
          router.replace('/two-factor');
          return;
        }
        api.setAccessToken(response.data.accessToken);
        setUser(response.data.user);
        router.replace('/dashboard');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [router],
  );

  const loginWithOtp = useCallback(
    async (email: string, code: string) => {
      const response = await api.post<{
        success: boolean;
        data: { user: User; accessToken: string };
      }>('/auth/otp/verify', { email, code, purpose: 'login' });
      if (response.success) {
        api.setAccessToken(response.data.accessToken);
        setUser(response.data.user);
        router.replace('/dashboard');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [router],
  );

  const requestOtp = useCallback(async (email: string, purpose: 'login' | 'reset') => {
    const response = await api.post<{
      success: boolean;
      data: { ok: boolean; cooldownMs: number | null };
    }>('/auth/otp/request', { email, purpose });
    return response.data;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const register = useCallback(
    async (data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      organizationName: string;
    }) => {
      const response = await api.post<{
        success: boolean;
        data: { user: User; accessToken: string };
      }>('/auth/register', data);
      if (response.success) {
        api.setAccessToken(response.data.accessToken);
        setUser(response.data.user);
        router.replace('/dashboard');
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [router],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore
    }
    api.setAccessToken(null);
    setUser(null);
    router.replace('/login');
  }, [router]);

  return { user, isLoading, login, loginWithOtp, requestOtp, register, logout };
}
