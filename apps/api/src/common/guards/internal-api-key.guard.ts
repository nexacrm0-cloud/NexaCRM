import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey: string | undefined = request.headers['x-internal-api-key'];

    if (!apiKey || !process.env.INTERNAL_API_KEY) {
      throw new UnauthorizedException('Invalid internal API key');
    }

    try {
      const expected = Buffer.from(process.env.INTERNAL_API_KEY);
      const actual = Buffer.from(apiKey);
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        throw new UnauthorizedException('Invalid internal API key');
      }
    } catch {
      throw new UnauthorizedException('Invalid internal API key');
    }

    return true;
  }
}
