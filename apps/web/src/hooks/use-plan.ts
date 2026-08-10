'use client';

import { useAuth } from './use-auth';

const PLAN_HIERARCHY: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export function usePlan() {
  const { user } = useAuth();
  const plan = user?.organizationPlan ?? 'free';
  const planLevel = PLAN_HIERARCHY[plan] ?? 0;

  const hasPlan = (required: string) => planLevel >= (PLAN_HIERARCHY[required] ?? 0);

  return {
    plan,
    planLevel,
    planLabel: PLAN_LABELS[plan] ?? plan,
    isFree: plan === 'free',
    isStarter: hasPlan('starter'),
    isPro: hasPlan('pro'),
    isEnterprise: hasPlan('enterprise'),
    hasPlan,
  };
}
