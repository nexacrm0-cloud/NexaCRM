'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ErrorBoundary } from '@/components/error-boundary';
import { useAuth } from '@/hooks/use-auth';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Loader2 } from 'lucide-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const { data: onboardingStatus } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: () => api.get<{ data: { needsOnboarding: boolean } }>('/auth/onboarding-status'),
    enabled: !!user,
  });

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (onboardingStatus?.data?.needsOnboarding && pathname !== '/onboarding') {
      router.push('/onboarding');
    }
  }, [onboardingStatus, pathname, router]);

  if (isLoading) {
    return (
      <div className="bg-background flex h-screen items-center justify-center">
        <Loader2 className="text-primary h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-background flex h-screen items-center justify-center">
        <Loader2 className="text-primary h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <DashboardLayout>
        <ErrorBoundary>{children}</ErrorBoundary>
      </DashboardLayout>
    </>
  );
}
