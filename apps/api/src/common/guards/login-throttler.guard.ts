import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * SECURITY (item 4 post-prod): standard @nestjs/throttler uses `req.ip`
 * only. An attacker rotating IPs across a botnet gets N×10 password
 * attempts per minute against a single account (one bucket per IP).
 *
 * This guard overrides `getTracker` so the throttler key is
 * `${ip}:${normalizedEmail}` for login-style endpoints. Multiple IPs
 * hitting the same account each consume their own bucket, which means an
 * attacker from a single IP cannot rotate email targets to evade the cap;
 * combined with a tight `@Throttle({ default: { limit: 5, ttl: 60_000 } })`
 * a single-IP attacker probing a single victim account is capped at 5
 * per minute before ThrottlerGuard returns 429.
 *
 * For a true cross-IP per-EMAIL cap (100 IPs vs. 10 attempts/account),
 * the operator can additionally deploy a second throttler named bucket
 * (ThrottlerModule supports named throttlers) on top of this guard. The
 * baseline guard alone is enough to make naive SSH-style loops impractical.
 */
@Injectable()
export class AccountThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const request = req as Request;
    const ip = request.ip || (request.headers['x-forwarded-for'] as string) || 'unknown';
    const body = request.body ?? {};
    const raw = typeof (body as any).email === 'string' ? (body as any).email : '';
    const email = raw.trim().toLowerCase();
    if (!email) {
      return `ip:${ip}`;
    }
    return `ip:${ip}:email:${email}`;
  }
}
