/**
 * SECURITY TESTS — Vector 5 (CSRF)
 *
 * Verifies the double-submit cookie middleware blocks cross-site mutation
 * attempts. The contract:
 *  - GET/HEAD/OPTIONS pass through and ensure the cookie exists.
 *  - Mutations on non-excluded paths MUST have a matching `x-csrf-token`
 *    header AND `csrf-token` cookie value.
 *  - Webhooks and `/auth/*` endpoints are intentionally excluded — those
 *    are protected by HMAC signatures or own credentials in the body.
 *
 * Any regression that allows a missing/mismatched token to pass would
 * re-open cross-site request forgery against every mutating endpoint.
 */
import { CsrfMiddleware } from '../csrf.middleware';
import type { Request, Response, NextFunction } from 'express';

const EXCLUDED_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/complete-login',
  '/api/v1/auth/accept-invitation',
  '/api/v1/auth/otp/',
  '/api/v1/webhooks/',
  '/api/v1/agent-actions',
];

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'POST',
    headers: {},
    cookies: {},
    originalUrl: '/api/v1/clients',
    ...overrides,
  } as Request;
}

function mockRes(): Response {
  const res = {} as Response;
  (res as any).status = jest.fn().mockReturnValue(res);
  (res as any).json = jest.fn().mockReturnValue(res);
  (res as any).cookie = jest.fn().mockReturnValue(res);
  return res;
}

describe('CsrfMiddleware', () => {
  let mw: CsrfMiddleware;
  let next: NextFunction;

  beforeEach(() => {
    mw = new CsrfMiddleware();
    next = jest.fn();
  });

  describe('safe methods (GET/HEAD/OPTIONS)', () => {
    it.each(['GET', 'HEAD', 'OPTIONS'])('passes %s through', (method) => {
      const req = mockReq({ method });
      const res = mockRes();
      mw.use(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('sets csrf-token cookie on first safe request', () => {
      const req = mockReq({ method: 'GET', cookies: {} });
      const res = mockRes();
      mw.use(req, res, next);
      expect((res as any).cookie).toHaveBeenCalledWith(
        'csrf-token',
        expect.any(String),
        expect.objectContaining({
          httpOnly: false,
          sameSite: 'strict',
          path: '/',
        }),
      );
      expect(next).toHaveBeenCalled();
    });
  });

  describe('mutating methods (POST/PUT/PATCH/DELETE)', () => {
    it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('rejects %s without csrf cookie', (method) => {
      const req = mockReq({ method });
      const res = mockRes();
      mw.use(req, res, next);
      expect((res as any).status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects when header does not match cookie', () => {
      const req = mockReq({
        method: 'POST',
        cookies: { 'csrf-token': 'aaa' },
        headers: { 'x-csrf-token': 'bbb' },
      });
      const res = mockRes();
      mw.use(req, res, next);
      expect((res as any).status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('accepts matching header + cookie', () => {
      const req = mockReq({
        method: 'POST',
        cookies: { 'csrf-token': 'matching-token' },
        headers: { 'x-csrf-token': 'matching-token' },
      });
      const res = mockRes();
      mw.use(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('rejects when header is missing entirely', () => {
      const req = mockReq({
        method: 'POST',
        cookies: { 'csrf-token': 'aaa' },
        headers: {},
      });
      const res = mockRes();
      mw.use(req, res, next);
      expect((res as any).status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('excluded paths', () => {
    it.each(EXCLUDED_PATHS)('skips CSRF check for %s (no token needed)', (path) => {
      const req = mockReq({ method: 'POST', originalUrl: path, cookies: {} });
      const res = mockRes();
      mw.use(req, res, next);
      expect(next).toHaveBeenCalled();
      expect((res as any).status).not.toHaveBeenCalled();
    });
  });
});
