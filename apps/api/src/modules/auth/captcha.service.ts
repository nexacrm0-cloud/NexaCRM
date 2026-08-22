import { Injectable, Logger, BadRequestException } from '@nestjs/common';

/**
 * SECURITY D6: validates Cloudflare Turnstile CAPTCHA tokens against the
 * siteverify endpoint. The token is single-use and short-lived; the response
 * includes `success: boolean` plus `error-codes` if the validation failed.
 *
 * We accept the token when TURNSTILE_SECRET_KEY is unset ONLY in non-prod
 * environments (mirrors the pattern used by the WhatsApp HMAC verifier).
 */
@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);

  /**
   * Verifies a Turnstile token against Cloudflare's siteverify endpoint.
   * Throws BadRequestException if the token is missing (when required) or
   * Cloudflare rejects it. Returns silently on success.
   */
  async verifyTurnstile(token: string | undefined, remoteIp?: string): Promise<void> {
    const secret = process.env.TURNSTILE_SECRET_KEY;

    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new BadRequestException('CAPTCHA no configurado en el servidor');
      }
      // Dev mode: skip verification so local development doesn't require
      // a Turnstile account. Logged as a warning so it's visible in CI.
      this.logger.warn('TURNSTILE_SECRET_KEY not set; skipping CAPTCHA verification (dev only)');
      return;
    }

    if (!token) {
      throw new BadRequestException('CAPTCHA token requerido');
    }

    const formData = new URLSearchParams();
    formData.append('secret', secret);
    formData.append('response', token);
    if (remoteIp) formData.append('remoteip', remoteIp);

    let res: Response;
    try {
      res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });
    } catch (err) {
      this.logger.error(`Turnstile siteverify fetch failed: ${(err as Error).message}`);
      // Fail-closed: if we can't reach Cloudflare, reject the login attempt.
      // The ThrottlerGuard (5/min) already bounds the attack surface; one
      // extra failure is acceptable. Better than letting an attacker who
      // can also block egress bypass CAPTCHA.
      throw new BadRequestException('CAPTCHA verification unavailable');
    }

    if (!res.ok) {
      this.logger.error(`Turnstile siteverify HTTP ${res.status}`);
      throw new BadRequestException('CAPTCHA verification failed');
    }

    const body = (await res.json()) as { success: boolean; 'error-codes'?: string[] };
    if (!body.success) {
      this.logger.warn(
        `Turnstile verification rejected: ${body['error-codes']?.join(', ') ?? 'unknown'}`,
      );
      throw new BadRequestException('CAPTCHA inválido o expirado');
    }
  }
}
