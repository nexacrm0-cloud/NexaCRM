import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { redactPII } from '../utils/pii-redaction';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const userId = request.user?.id || 'anonymous';
    const organizationId = request.user?.organizationId || 'none';
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          this.logger.log(
            JSON.stringify({
              method,
              url: redactPII(url),
              statusCode: response.statusCode,
              durationMs: Date.now() - now,
              userId,
              organizationId,
              timestamp: new Date().toISOString(),
            }),
          );
        },
        error: (error) => {
          // SECURITY: scrub PII from URL (?token=...) and from the error
          // message before logging. error.message can echo back parts of
          // the request (e.g. "Invalid token: eyJ..."). Combined with
          // HttpExceptionFilter, this is the last line of defense against
          // credentials leaking into log files / Sentry.
          this.logger.error(
            JSON.stringify({
              method,
              url: redactPII(url),
              durationMs: Date.now() - now,
              userId,
              organizationId,
              error: redactPII(error.message),
              timestamp: new Date().toISOString(),
            }),
          );
        },
      }),
    );
  }
}
