/**
 * Shared helpers for time-boxed sales demo tenants.
 *
 * A demo tenant is an Organization flagged with `isDemo` and an absolute
 * `demoExpiresAt`. The deadline is enforced server-side on every request
 * path, so "exactly one week" means exactly one week regardless of how often
 * the housekeeping cron runs.
 */

export const DEMO_DURATION_DAYS = 7;

export const DEMO_DURATION_MS = DEMO_DURATION_DAYS * 24 * 60 * 60 * 1000;

export const DEMO_EXPIRED_MESSAGE =
  'Tu demo de 7 días ya terminó. Escribinos para activar tu plan.';

export type DemoWindow = {
  isDemo?: boolean | null;
  demoExpiresAt?: Date | string | null;
};

export function getDemoExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + DEMO_DURATION_MS);
}

export function isDemoExpired(
  window: DemoWindow | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!window?.isDemo) return false;
  if (!window.demoExpiresAt) return false;
  return new Date(window.demoExpiresAt).getTime() <= now.getTime();
}

export function getDemoRemainingMs(
  window: DemoWindow | null | undefined,
  now: Date = new Date(),
): number {
  if (!window?.isDemo || !window.demoExpiresAt) return 0;
  return Math.max(0, new Date(window.demoExpiresAt).getTime() - now.getTime());
}

/**
 * Human readable countdown, e.g. "6d 23h 14m". Used by the dashboard banner
 * so the prospect always sees how much demo time is left.
 */
export function formatDemoRemaining(remainingMs: number): string {
  if (remainingMs <= 0) return '0m';

  const totalMinutes = Math.floor(remainingMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0) return 'menos de 1m';

  return parts.join(' ');
}
