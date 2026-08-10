'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

type OrgSettings = {
  organization: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    plan: string;
    currency: string;
    locale: string;
  };
};

export function useOrganizationCurrency() {
  const { data, isLoading } = useQuery<OrgSettings>({
    queryKey: ['settings', 'organization'],
    queryFn: () => api.get<OrgSettings>('/settings'),
    staleTime: 5 * 60 * 1000,
  });

  return {
    currency: data?.organization.currency ?? 'ARS',
    locale: data?.organization.locale ?? 'es-AR',
    isLoading,
  };
}
