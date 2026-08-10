import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PrismaService } from '@nexa/database';
import { JwtPayload } from '@nexa/shared';
import { EventBusService } from '../../event-bus/event-bus.service';
import { v4 as uuid } from 'uuid';
import { TwoFactorService } from './two-factor.service';

// SECURITY H-07: store refresh tokens hashed (SHA-256), never plaintext.
// If the DB is ever dumped, attackers cannot reuse the refresh column
// directly; the JWT signature check still applies and the lost row is
// worthless without a matching input token.
function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private twoFactorService: TwoFactorService,
    private eventBus: EventBusService,
  ) {}

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    organizationName: string;
    currency?: string;
  }) {
    const passwordHash = await bcrypt.hash(data.password, 12);
    const baseSlug =
      data.organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'workspace';

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: data.email } });
      if (existing) {
        throw new ConflictException('El email ya está registrado');
      }

      let slug = `${baseSlug}-${randomBytes(3).toString('hex')}`;
      while (await tx.organization.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${randomBytes(3).toString('hex')}`;
      }

      const org = await tx.organization.create({
        data: {
          name: data.organizationName,
          slug,
          currency: data.currency ?? 'ARS',
        },
      });

      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          role: 'OWNER',
          organizationId: org.id,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          organizationId: true,
          organization: { select: { name: true } },
        },
      });

      const stages = [
        { name: 'Lead', position: 0, color: '#94a3b8' },
        { name: 'Contactado', position: 1, color: '#3b82f6' },
        { name: 'Reunión', position: 2, color: '#8b5cf6' },
        { name: 'Propuesta', position: 3, color: '#f59e0b' },
        { name: 'Negociación', position: 4, color: '#ef4444' },
        { name: 'Ganado', position: 5, color: '#22c55e', isWinStage: true },
        { name: 'Perdido', position: 6, color: '#6b7280', isLoseStage: true },
      ];

      for (const stage of stages) {
        await tx.pipelineStage.create({
          data: { ...stage, organizationId: org.id },
        });
      }

      return user;
    });

    const tokens = await this.generateTokens({
      sub: result.id,
      email: result.email,
      organizationId: result.organizationId,
      role: result.role as any,
    });

    await this.prisma.user.update({
      where: { id: result.id },
      data: { refreshToken: hashRefreshToken(tokens.refreshToken), lastLoginAt: new Date() },
    });

    this.logger.log(`User registered: ${result.email}`);

    this.eventBus.emit({
      eventName: 'organization.created',
      aggregateType: 'organization',
      aggregateId: result.organizationId,
      payload: { name: data.organizationName },
      metadata: {
        organizationId: result.organizationId,
        userId: result.id,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    this.eventBus.emit({
      eventName: 'user.created',
      aggregateType: 'user',
      aggregateId: result.id,
      payload: {
        userId: result.id,
        email: result.email,
        firstName: result.firstName,
        lastName: result.lastName,
        role: result.role,
      },
      metadata: {
        organizationId: result.organizationId,
        userId: result.id,
        correlationId: crypto.randomUUID(),
        timestamp: new Date(),
      },
    });

    // SECURITY M-14: create an email verification token so the user
    // must confirm ownership of the address. The account is fully
    // functional for an initial grace period (7 days) but critical
    // features (accept-invitation with existing org) should check
    // emailVerifiedAt.
    const verifyToken = uuid();
    await this.prisma.emailVerificationToken.create({
      data: {
        email: result.email,
        token: verifyToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: {
        id: result.id,
        email: result.email,
        firstName: result.firstName,
        lastName: result.lastName,
        role: result.role,
        organizationId: result.organizationId,
        organizationName: (result as any).organization.name,
        emailVerifiedAt: null,
      },
      verificationToken: verifyToken,
      ...tokens,
    };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { organization: { select: { name: true, plan: true } } },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // If 2FA is enabled, return requiresTwoFactor AND a short-lived signed
    // "login pending" token whose ONLY valid consumer is the complete-login
    // endpoint. This proves that complete-login was preceded by a real
    // password check (CR-02 mitigation): the caller must present both the
    // pending token AND a valid TOTP. Without this, an attacker could call
    // /auth/2fa/complete-login with just a userId and brute-force TOTP.
    if (user.isTwoFactorEnabled) {
      const pendingToken = await this.jwtService.signAsync(
        { sub: user.id, twofa: true },
        { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '5m' },
      );
      return {
        requiresTwoFactor: true,
        userId: user.id,
        pendingToken,
      };
    }

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role as any,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashRefreshToken(tokens.refreshToken), lastLoginAt: new Date() },
    });

    this.logger.log(`User logged in: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
        organizationPlan: (user.organization as any).plan ?? 'free',
      },
      ...tokens,
    };
  }

  async completeTwoFactorLogin(userId: string, token: string, pendingToken: string | undefined) {
    // SECURITY CR-02: a pending login token signed by our own /login flow
    // must verify before any TOTP is probed. This binds the second factor to
    // a previously validated password.
    if (!pendingToken) {
      throw new UnauthorizedException('Pending login token requerido');
    }
    let pendingSub: string;
    try {
      const pending = this.jwtService.verify(pendingToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      if (!pending?.twofa || pending.sub !== userId) {
        throw new UnauthorizedException('Pending login token inválido');
      }
      pendingSub = pending.sub;
    } catch {
      throw new UnauthorizedException('Pending login token inválido o expirado');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: pendingSub },
      include: { organization: { select: { name: true, plan: true } } },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    if (!user.isTwoFactorEnabled) {
      throw new BadRequestException('2FA no está habilitado para este usuario');
    }

    const isValid = await this.twoFactorService.validateCode(userId, token);
    if (!isValid) {
      throw new BadRequestException('Código de verificación inválido');
    }

    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role as any,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashRefreshToken(tokens.refreshToken), lastLoginAt: new Date() },
    });

    this.logger.log(`User completed 2FA login: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
        organizationPlan: user.organization.plan ?? 'free',
      },
      ...tokens,
    };
  }

  async refresh(token: string | undefined) {
    if (!token) {
      throw new UnauthorizedException('Refresh token no proporcionado');
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          organizationId: true,
          role: true,
          refreshToken: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Usuario no encontrado o inactivo');
      }

      const tokenHash = hashRefreshToken(token);

      if (user.refreshToken !== tokenHash) {
        this.logger.warn(`Possible token theft detected for user ${user.id}`);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { refreshToken: null },
        });
        throw new UnauthorizedException('TOKEN_STOLEN');
      }

      const tokens = await this.generateTokens({
        sub: user.id,
        email: user.email,
        organizationId: user.organizationId,
        role: user.role as any,
      });

      // Atomic compare-and-set on the hash; if the row changed meanwhile
      // (rotation, logout, reset), we reject the rotation.
      const result = await this.prisma.user.updateMany({
        where: { id: user.id, refreshToken: tokenHash },
        data: { refreshToken: hashRefreshToken(tokens.refreshToken) },
      });

      if (result.count === 0) {
        throw new UnauthorizedException('Refresh token inválido o expirado');
      }

      return tokens;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  async forgotPassword(email: string): Promise<{ token: string | null; message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // SECURITY M1: do NOT log the email itself and do not differentiate in
      // the response. Only record that a reset was attempted for an unknown
      // account (without the address) to avoid PII leakage in shared logs.
      this.logger.warn('Password reset requested for unknown email');
      return {
        token: null,
        message: 'Si el email está registrado, recibirás un enlace para restablecer tu contraseña',
      };
    }

    const token = uuid();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.passwordResetToken.create({
      data: { email, token, expiresAt },
    });

    this.logger.log(`Password reset token generated for user ${user.id}`);
    return {
      token,
      message: 'Si el email está registrado, recibirás un enlace para restablecer tu contraseña',
    };
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!record || record.usedAt) {
      throw new BadRequestException('Token inválido o ya utilizado');
    }

    if (record.expiresAt < new Date()) {
      throw new BadRequestException('El token ha expirado');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    // SECURITY: also revoke any active refresh token for that user (same as
    // reset on a stolen-account scenario) — already done in the original.
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { email: record.email },
        data: { passwordHash, refreshToken: null },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    this.logger.log('Password reset completed');
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        phone: true,
        role: true,
        isTwoFactorEnabled: true,
        organizationId: true,
        organization: { select: { name: true, plan: true, logo: true } },
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return user;
  }

  async checkOnboardingStatus(userId: string, organizationId: string) {
    const [org, clientCount, dealCount, taskCount] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { onboardingCompletedAt: true },
      }),
      this.prisma.client.count({ where: { organizationId } }),
      this.prisma.deal.count({ where: { organizationId } }),
      this.prisma.task.count({ where: { organizationId } }),
    ]);
    return {
      needsOnboarding: !org?.onboardingCompletedAt && clientCount === 0,
      clientCount,
      dealCount,
      taskCount,
    };
  }

  async completeOnboarding(organizationId: string, currency?: string) {
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        onboardingCompletedAt: new Date(),
        ...(currency ? { currency } : {}),
      },
    });
  }

  async loginFromOtp(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    organizationId: string;
    organization: { name: string; plan: string };
  }) {
    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role as any,
    });
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashRefreshToken(tokens.refreshToken), lastLoginAt: new Date() },
    });
    this.logger.log(`User logged in (otp): ${user.email}`);
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
        organizationPlan: user.organization.plan ?? 'free',
      },
      ...tokens,
    };
  }

  async sendVerificationEmail(email: string): Promise<{ ok: boolean; token?: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // No account → silently succeed (anti-enumeration).
      return { ok: true };
    }
    if (user.emailVerifiedAt) {
      return { ok: true };
    }

    // Invalidate any existing tokens for this email first.
    await this.prisma.emailVerificationToken.deleteMany({ where: { email } });

    const token = uuid();
    await this.prisma.emailVerificationToken.create({
      data: {
        email,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    return { ok: true, token };
  }

  async verifyEmail(token: string): Promise<boolean> {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { token },
    });
    if (!record || record.usedAt) {
      throw new BadRequestException('Token inválido o ya utilizado');
    }
    if (record.expiresAt < new Date()) {
      throw new BadRequestException('El token ha expirado');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { email: record.email },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    this.logger.log(`Email verified for ${record.email}`);
    return true;
  }

  private async generateTokens(payload: JwtPayload) {
    const tokenId = uuid();
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({
        ...payload,
        tokenId,
      }),
      this.jwtService.signAsync(
        {
          sub: payload.sub,
          tokenId,
          email: payload.email,
          organizationId: payload.organizationId,
          role: payload.role,
        },
        {
          secret: process.env.JWT_REFRESH_SECRET,
          expiresIn: '7d',
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }
}
