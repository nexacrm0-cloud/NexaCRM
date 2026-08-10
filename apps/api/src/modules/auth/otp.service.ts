import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@nexa/database';
import { NotificationsService } from '../notifications/notifications.service';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcryptjs';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 min
const MAX_ATTEMPTS = 5;
const RECENT_REQUEST_MS = 30 * 1000; // debounce realtime
const COOLDOWN_MS = 60 * 1000; // soft cooldown

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private generateCode(): string {
    let code = '';
    for (let i = 0; i < 6; i += 1) code += randomInt(0, 10).toString();
    return code;
  }

  async requestOtp(
    email: string,
    purpose: 'login' | 'reset',
  ): Promise<{ ok: true; cooldownMs?: number }> {
    const normalized = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
      throw new BadRequestException('Email inválido');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      include: { organization: { select: { name: true } } },
    });
    if (!user || !user.isActive) {
      // Igual devolvemos ok para no exponer existencia de cuentas
      this.logger.warn(`OTP requested for unknown/inactive email: ${normalized}`);
      return { ok: true };
    }

    const recent = await this.prisma.otpCode.findFirst({
      where: { email: normalized, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (recent) {
      const ageMs = Date.now() - recent.createdAt.getTime();
      if (ageMs < RECENT_REQUEST_MS) {
        const wait = RECENT_REQUEST_MS - ageMs;
        return { ok: true, cooldownMs: wait };
      }
      // marca el anterior consumido para evitar acumulación
      await this.prisma.otpCode.update({
        where: { id: recent.id },
        data: { consumedAt: new Date() },
      });
    }

    const code = this.generateCode();
    const codeHash = await bcrypt.hash(code, 6);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.prisma.otpCode.create({
      data: {
        email: normalized,
        code: codeHash,
        purpose,
        expiresAt,
        userId: user.id,
        organizationId: user.organizationId,
      },
    });

    await this.notifications
      .sendOtpEmail({
        to: normalized,
        firstName: user.firstName,
        code,
        purpose,
        expiresInMinutes: 10,
      })
      .catch((err) =>
        this.logger.warn(
          `Failed sending OTP mail to ${normalized}: ${err instanceof Error ? err.message : 'unknown'}`,
        ),
      );

    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`[DEV OTP] email=${normalized} code=${code}`);
    }

    return { ok: true };
  }

  async verifyOtp(
    email: string,
    code: string,
    purpose: 'login' | 'reset',
  ): Promise<{ user: any; isNew: boolean }> {
    const normalized = email.trim().toLowerCase();

    const candidate = await this.prisma.otpCode.findFirst({
      where: { email: normalized, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!candidate || candidate.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Código expirado o inexistente');
    }

    if (candidate.attempts >= MAX_ATTEMPTS) {
      throw new UnauthorizedException('Demasiados intentos. Pedí un código nuevo.');
    }

    const matches = await bcrypt.compare(code.trim(), candidate.code);
    if (!matches) {
      await this.prisma.otpCode.update({
        where: { id: candidate.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Código incorrecto');
    }

    await this.prisma.otpCode.update({
      where: { id: candidate.id },
      data: { consumedAt: new Date() },
    });

    const user = candidate.userId
      ? await this.prisma.user.findUnique({
          where: { id: candidate.userId },
          include: { organization: { select: { name: true, plan: true, currency: true } } },
        })
      : await this.prisma.user.findUnique({
          where: { email: normalized },
          include: { organization: { select: { name: true, plan: true, currency: true } } },
        });

    return { user, isNew: false };
  }
}
