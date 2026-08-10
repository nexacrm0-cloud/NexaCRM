import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PrismaService } from '@nexa/database';
import { EventBusService } from '../../event-bus/event-bus.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  async getProfile(userId: string, prismaSelect?: Record<string, true>) {
    // Default select explicitly lists every non-sensitive column so a future
    // schema addition (e.g. a new `recoveryCodes` column) can't silently leak
    // into /users/me. When the caller passes a ?select= projection we use it
    // verbatim — buildSelect() already validates against an allowlist AND
    // blocks the SENSITIVE_FIELDS denylist, so there's no need to re-check
    // here.
    const select = prismaSelect ?? {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      phone: true,
      role: true,
      organizationId: true,
      organization: { select: { name: true, plan: true, logo: true } },
      lastLoginAt: true,
      createdAt: true,
    };

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select,
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string; phone?: string; avatarUrl?: string },
  ) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        phone: true,
        role: true,
        organizationId: true,
      },
    });

    this.eventBus.emit({
      eventName: 'user.updated',
      aggregateType: 'user',
      aggregateId: userId,
      payload: { userId, ...data },
      metadata: {
        organizationId: user.organizationId,
        userId,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    return user;
  }

  async updatePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, email: true },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Contraseña actual incorrecta');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    // SECURITY CR-03: changing the password MUST invalidate any previously
    // issued refresh token, otherwise an attacker that captured the refresh
    // token before the victim rotated the password keeps access for up to
    // 7 days. We null it here; the user (legitimately logged in) keeps the
    // current access token (15m max) and a new refresh is issued on next
    // login.
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, refreshToken: null },
    });
    this.logger.log(`Password changed for user ${user.email}; refresh revoked`);
  }
}
