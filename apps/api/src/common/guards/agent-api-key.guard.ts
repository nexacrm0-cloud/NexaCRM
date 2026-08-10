import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@nexa/database';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class AgentApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-agent-api-key'] as string;

    if (!apiKey || typeof apiKey !== 'string') {
      throw new UnauthorizedException('Missing x-agent-api-key header');
    }

    const subscription = await this.prisma.agentSubscription.findFirst({
      where: { apiKey },
      include: {
        agent: true,
      },
    });

    if (!subscription) {
      throw new UnauthorizedException('Invalid agent API key');
    }

    if (!subscription.isActive) {
      throw new UnauthorizedException('Agent subscription is inactive');
    }

    if (!subscription.agent.isActive) {
      throw new UnauthorizedException('Agent is not active');
    }

    request.agentSubscription = subscription;
    request.agent = subscription.agent;
    request.organizationId = subscription.organizationId;

    return true;
  }
}
