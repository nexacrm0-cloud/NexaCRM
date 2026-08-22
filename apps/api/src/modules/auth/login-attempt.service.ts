import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * SECURITY D6: tracks failed authentication attempts per IP+email to decide
 * when to require a CAPTCHA challenge. Backed by Redis so the counter
 * survives across replicas and process restarts.
 *
 * Two counters are exposed:
 *   - recordFailure(): increments the bucket; if it crosses the threshold
 *     the next call to shouldRequireCaptcha() returns true.
 *   - recordSuccess(): deletes the bucket — a successful login clears the
 *     penalty so the user is not stuck solving CAPTCHAs forever after one
 *     typo.
 *
 * The TTL on the bucket bounds memory: even if the user never comes back,
 * the counter expires after CAPTCHA_WINDOW_SECONDS and they get a clean slate.
 */
@Injectable()
export class LoginAttemptService {
  private readonly logger = new Logger(LoginAttemptService.name);
  private redis: Redis | null = null;
  private readonly WINDOW_SECONDS = 15 * 60; // 15 min sliding window
  // SECURITY D6: trigger CAPTCHA after this many failures within WINDOW_SECONDS.
  // Set conservatively — false negatives (let an attacker slip through) are
  // worse than false positives (annoy a legitimate user with a CAPTCHA once).
  //
  // Override via CAPTCHA_THRESHOLD env var for testing / gradual rollout.
  // Useful while you're setting up the widget: set it to 999 in prod to
  // effectively disable, then lower it to 3 once the integration is
  // verified end-to-end.
  private readonly THRESHOLD = (() => {
    const fromEnv = parseInt(process.env.CAPTCHA_THRESHOLD ?? '', 10);
    return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 3;
  })();

  constructor() {
    const url = process.env.REDIS_URL;
    if (url) {
      this.redis = new Redis(url, {
        maxRetriesPerRequest: null,
        enableOfflineQueue: false,
        lazyConnect: false,
      });
      this.redis.on('error', (err) => {
        // Fail-open: if Redis is unreachable, log and fall back to "no
        // CAPTCHA required" rather than blocking legitimate logins. The
        // global ThrottlerGuard already bounds brute-force at the IP level
        // even if this counter is unavailable.
        if (!err.message.includes('ECONNREFUSED')) {
          this.logger.warn(`Redis error in LoginAttemptService: ${err.message}`);
        }
        this.redis = null;
      });
    } else {
      this.logger.warn('REDIS_URL not set; LoginAttemptService falling back to in-memory');
    }
  }

  private bucketKey(ip: string, email: string): string {
    return `nexa:login-attempts:${ip}:${email.toLowerCase()}`;
  }

  async recordFailure(ip: string, email: string): Promise<number> {
    const key = this.bucketKey(ip, email);
    if (!this.redis) return 0;
    try {
      const count = await this.redis.incr(key);
      if (count === 1) {
        // First failure in this window — set the TTL.
        await this.redis.expire(key, this.WINDOW_SECONDS);
      }
      return count;
    } catch {
      return 0;
    }
  }

  async recordSuccess(ip: string, email: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(this.bucketKey(ip, email));
    } catch {
      // ignore
    }
  }

  async shouldRequireCaptcha(ip: string, email: string): Promise<boolean> {
    const key = this.bucketKey(ip, email);
    if (!this.redis) return false;
    try {
      const count = await this.redis.get(key);
      return count !== null && parseInt(count, 10) >= this.THRESHOLD;
    } catch {
      return false;
    }
  }
}
