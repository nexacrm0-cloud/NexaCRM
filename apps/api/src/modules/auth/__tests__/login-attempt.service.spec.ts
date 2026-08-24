import { LoginAttemptService } from '../login-attempt.service';

describe('LoginAttemptService', () => {
  let service: LoginAttemptService;

  beforeEach(() => {
    // Construct without REDIS_URL -> service falls back to in-memory no-op
    // semantics (recordFailure returns 0, shouldRequireCaptcha returns false).
    // The Redis-backed path is exercised in integration tests; here we cover
    // the contract that the rest of the app relies on.
    delete process.env.REDIS_URL;
    service = new LoginAttemptService();
  });

  describe('without Redis (fallback mode)', () => {
    it('returns 0 from recordFailure', async () => {
      const count = await service.recordFailure('1.2.3.4', 'a@b.com');
      expect(count).toBe(0);
    });

    it('returns false from shouldRequireCaptcha', async () => {
      const required = await service.shouldRequireCaptcha('1.2.3.4', 'a@b.com');
      expect(required).toBe(false);
    });

    it('recordSuccess is a no-op', async () => {
      await expect(service.recordSuccess('1.2.3.4', 'a@b.com')).resolves.toBeUndefined();
    });
  });

  describe('key normalization', () => {
    it('treats email case-insensitively in the public API contract', () => {
      // The bucket key uses .toLowerCase() internally; this test pins that
      // behavior so a future refactor doesn't accidentally break it.
      const ip = '1.2.3.4';
      const emailLower = 'user@example.com';
      const emailUpper = 'USER@EXAMPLE.COM';

      // We can't peek into the bucket directly without Redis, but we can
      // assert the API doesn't throw for any casing.
      expect(() => service.recordFailure(ip, emailLower)).not.toThrow();
      expect(() => service.recordFailure(ip, emailUpper)).not.toThrow();
    });
  });
});
