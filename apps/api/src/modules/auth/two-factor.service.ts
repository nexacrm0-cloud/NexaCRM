import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@nexa/database';
import { generateSecret, generateURI, verify } from 'otplib';
import { toDataURL } from 'qrcode';

// SECURITY M-11: lock the TOTP window to 0 (= accept ONLY the current 30s
// step) so brute-force over /auth/2fa/complete-login cannot expand to the
// previous/next windows (default otplib window=1 triples the search space).
const TOTP_OPTS = { window: 0 } as const;

@Injectable()
export class TwoFactorService {
  constructor(private prisma: PrismaService) {}

  async generateSecret(userId: string, email: string) {
    const secret = generateSecret();
    const otpauth = generateURI({ issuer: 'Nexa CRM', label: email, secret });
    const qrCode = await toDataURL(otpauth);

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    return { secret, qrCode, otpauth };
  }

  async verifyAndEnable(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorSecret) {
      throw new BadRequestException('2FA no configurado. Genere un secreto primero.');
    }

    const result = await verify({ token, secret: user.twoFactorSecret, ...TOTP_OPTS });
    if (!result.valid) {
      throw new BadRequestException('Código inválido');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isTwoFactorEnabled: true },
    });

    return { success: true };
  }

  async disable(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isTwoFactorEnabled) {
      throw new BadRequestException('2FA no está habilitado');
    }

    const result = await verify({ token, secret: user.twoFactorSecret!, ...TOTP_OPTS });
    if (!result.valid) {
      throw new BadRequestException('Código inválido');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: null, isTwoFactorEnabled: false },
    });

    return { success: true };
  }

  async validateCode(userId: string, token: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isTwoFactorEnabled || !user.twoFactorSecret) return false;
    const result = await verify({ token, secret: user.twoFactorSecret, ...TOTP_OPTS });
    return result.valid;
  }
}
