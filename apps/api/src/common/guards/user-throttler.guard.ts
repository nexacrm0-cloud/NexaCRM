import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

interface AuthedRequest extends Request {
  user?: { id?: string; organizationId?: string };
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]!.trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

@Injectable()
export class UserOrIpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const request = req as AuthedRequest;
    const ip = getClientIp(request);

    const userId = request.user?.id;
    const orgId = request.user?.organizationId;

    if (userId && orgId) {
      return `user:${userId}:org:${orgId}`;
    }

    if (orgId) {
      return `org:${orgId}:ip:${ip}`;
    }

    return `ip:${ip}`;
  }
}
