import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_COOKIE_BASE = 'csrf-token';
const CSRF_HEADER = 'x-csrf-token';

const isProd = () => process.env.NODE_ENV === 'production';
const csrfCookieName = () => (isProd() ? `__Host-${CSRF_COOKIE_BASE}` : CSRF_COOKIE_BASE);

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

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (EXCLUDED_PATHS.some((p) => req.originalUrl.startsWith(p))) {
      return next();
    }

    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      this.ensureCookie(req, res);
      return next();
    }

    const cookieToken = req.cookies?.[csrfCookieName()];

    if (!cookieToken) {
      res.status(403).json({
        statusCode: 403,
        message: 'CSRF token no encontrado. Recargá la página e intentá de nuevo.',
        error: 'Forbidden',
      });
      return;
    }

    const headerToken = req.headers[CSRF_HEADER] as string;

    if (!headerToken || headerToken !== cookieToken) {
      res.status(403).json({
        statusCode: 403,
        message: 'CSRF token inválido',
        error: 'Forbidden',
      });
      return;
    }

    next();
  }

  private ensureCookie(req: Request, res: Response) {
    if (!req.cookies?.[CSRF_COOKIE_BASE]) {
      const token = crypto.randomBytes(32).toString('hex');
      const isProd = process.env.NODE_ENV === 'production';
      // __Host- prefix in production: cookie can only be set/cleared over
      // HTTPS from the exact host (no subdomain spoofing, no path override).
      // httpOnly: false is required for double-submit pattern (JS must read it).
      const cookieName = isProd ? `__Host-${CSRF_COOKIE_BASE}` : CSRF_COOKIE_BASE;
      res.cookie(cookieName, token, {
        httpOnly: false,
        secure: isProd,
        sameSite: 'strict',
        path: '/',
      });
    }
  }
}
