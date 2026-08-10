import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

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
              url,
              statusCode: response.statusCode,
              durationMs: Date.now() - now,
              userId,
              organizationId,
              timestamp: new Date().toISOString(),
            }),
          );
        },
        error: (error) => {
          this.logger.error(
            JSON.stringify({
              method,
              url,
              durationMs: Date.now() - now,
              userId,
              organizationId,
              error: error.message,
              timestamp: new Date().toISOString(),
            }),
          );
        },
      }),
    );
  }
}
