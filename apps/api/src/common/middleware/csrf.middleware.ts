import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_COOKIE = 'csrf-token';
const CSRF_HEADER = 'x-csrf-token';

const EXCLUDED_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/register',
  '/api/v1/auth/refresh',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
  '/api/v1/auth/complete-login',
  '/api/v1/auth/accept-invitation',
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

    const cookieToken = req.cookies?.[CSRF_COOKIE];

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
    if (!req.cookies?.[CSRF_COOKIE]) {
      const token = crypto.randomBytes(32).toString('hex');
      res.cookie(CSRF_COOKIE, token, {
        // CSRF cookie must be JS-readable (double-submit pattern), but it
        // is bound to the host and never carries session info, so dropping
        // httpOnly is acceptable. In prod we still pin secure + sameSite
        // and the SPA reads it back via document.cookie on the same host.
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
    }
  }
}
