import { BadRequestException } from '@nestjs/common';
import { CaptchaService } from '../captcha.service';

describe('CaptchaService', () => {
  let service: CaptchaService;
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
  const ORIGINAL_FETCH = global.fetch;

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    global.fetch = ORIGINAL_FETCH;
    jest.restoreAllMocks();
  });

  describe('without TURNSTILE_SECRET_KEY (dev mode)', () => {
    beforeEach(() => {
      delete process.env.TURNSTILE_SECRET_KEY;
      service = new CaptchaService();
    });

    it('skips verification in non-production (dev)', async () => {
      process.env.NODE_ENV = 'development';
      // The service logs a warning via its own Logger instance. We assert
      // the silent-success behavior (no throw) rather than spying on the
      // private logger, which is implementation detail.
      await expect(service.verifyTurnstile(undefined)).resolves.toBeUndefined();
    });

    it('throws BadRequest when no secret in production', async () => {
      process.env.NODE_ENV = 'production';
      await expect(service.verifyTurnstile('any-token')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws BadRequest when secret is set but token missing', async () => {
      process.env.TURNSTILE_SECRET_KEY = 'test-secret';
      service = new CaptchaService();
      await expect(service.verifyTurnstile(undefined)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('with TURNSTILE_SECRET_KEY (production)', () => {
    beforeEach(() => {
      process.env.TURNSTILE_SECRET_KEY = 'test-secret';
      process.env.NODE_ENV = 'production';
      service = new CaptchaService();
    });

    it('accepts a token when Cloudflare returns success:true', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as any);
      await expect(service.verifyTurnstile('valid-token')).resolves.toBeUndefined();
    });

    it('throws BadRequest when Cloudflare returns success:false', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
      } as any);
      await expect(service.verifyTurnstile('bad-token')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws BadRequest when Cloudflare HTTP fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      } as any);
      await expect(service.verifyTurnstile('token')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws BadRequest when fetch itself rejects (fail-closed)', async () => {
      // SECURITY: fail-closed on network errors. The ThrottlerGuard (5/min)
      // already bounds the attack surface; one extra failure is acceptable
      // over letting an attacker who can block egress bypass CAPTCHA.
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(service.verifyTurnstile('token')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('forwards remoteip to Cloudflare siteverify when provided', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as any);
      global.fetch = fetchMock;
      await service.verifyTurnstile('token', '203.0.113.42');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, init] = fetchMock.mock.calls[0];
      const body = (init as RequestInit).body as string;
      expect(body).toContain('remoteip=203.0.113.42');
      expect(body).toContain('secret=test-secret');
      expect(body).toContain('response=token');
    });
  });
});
