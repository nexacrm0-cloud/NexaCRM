import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_ERROR';
    let messages: string | string[] = 'Error interno del servidor';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      errorCode = this.getErrorCode(status, exception);

      if (typeof exceptionResponse === 'string') {
        messages = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as any;
        messages = resp.message || exception.message;
        details = resp.errors || resp.details;
        if (Array.isArray(resp.message)) {
          messages = resp.message;
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled exception: ${exception.message}`, exception.stack, {
        path: request.url,
        method: request.method,
      });
    }

    const errorBody = {
      success: false,
      error: {
        code: errorCode,
        message: Array.isArray(messages) ? messages.join('; ') : messages,
        ...(details ? { details } : {}),
      },
    };

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${status} - ${Array.isArray(messages) ? messages.join('; ') : messages}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} - ${status} - ${Array.isArray(messages) ? messages.join('; ') : messages}`,
      );
    }

    response.status(status).json(errorBody);
  }

  private getErrorCode(status: number, _exception: HttpException): string {
    const codeMap: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMIT_EXCEEDED',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
    };
    return codeMap[status] || 'INTERNAL_ERROR';
  }
}
