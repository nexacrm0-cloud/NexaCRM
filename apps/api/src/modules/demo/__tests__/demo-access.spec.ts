import { UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import {
  DEMO_EXPIRED_MESSAGE,
  formatDemoRemaining,
  getDemoRemainingMs,
  isDemoExpired,
} from '@nexa/shared';
import { demoExpiryFromNow } from '@nexa/database';
import type { PrismaService } from '@nexa/database';
import { AuthService } from '../../auth/auth.service';
import { JwtStrategy } from '../../../common/strategies/jwt.strategy';
import type { JwtService } from '@nestjs/jwt';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const bcryptMock = bcrypt as unknown as { compare: jest.Mock };

describe('Ventana de demo de 7 días', () => {
  describe('helpers compartidos', () => {
    it('abre una ventana de exactamente 7 días', () => {
      const now = new Date('2026-01-01T10:00:00.000Z');
      const expiry = demoExpiryFromNow(now);

      expect(expiry.getTime() - now.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('expira exactamente en el deadline, no un milisegundo antes', () => {
      const deadline = new Date('2026-01-08T10:00:00.000Z');

      expect(
        isDemoExpired({ isDemo: true, demoExpiresAt: deadline }, new Date(deadline.getTime() - 1)),
      ).toBe(false);
      expect(
        isDemoExpired({ isDemo: true, demoExpiresAt: deadline }, new Date(deadline.getTime())),
      ).toBe(true);
    });

    it('nunca expira un tenant que no es demo', () => {
      const past = new Date('2020-01-01T00:00:00.000Z');

      expect(isDemoExpired({ isDemo: false, demoExpiresAt: past })).toBe(false);
      expect(isDemoExpired({ isDemo: true, demoExpiresAt: null })).toBe(false);
      expect(isDemoExpired(null)).toBe(false);
    });

    it('calcula el tiempo restante y su etiqueta', () => {
      const now = new Date('2026-01-01T10:00:00.000Z');
      const window = {
        isDemo: true,
        demoExpiresAt: new Date(now.getTime() + (2 * 24 + 3) * 60 * 60 * 1000 + 15 * 60 * 1000),
      };

      expect(getDemoRemainingMs(window, now)).toBe((2 * 24 + 3) * 60 * 60 * 1000 + 15 * 60 * 1000);
      expect(formatDemoRemaining(getDemoRemainingMs(window, now))).toBe('2d 3h 15m');
      expect(formatDemoRemaining(0)).toBe('0m');
    });
  });

  describe('AuthService.login', () => {
    const buildService = (organization: Record<string, unknown>) => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-1',
            email: 'demo@nexacrm.com',
            firstName: 'Demo',
            lastName: 'Nexa',
            role: 'OWNER',
            isActive: true,
            isTwoFactorEnabled: false,
            passwordHash: 'hash',
            organizationId: 'org-1',
            organization,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
      };

      const jwt = { signAsync: jest.fn().mockResolvedValue('token'), verify: jest.fn() };

      const service = new AuthService(
        prisma as unknown as PrismaService,
        jwt as unknown as JwtService,
        {} as never,
        {} as never,
      );
      return { service, prisma, jwt };
    };

    beforeEach(() => {
      bcryptMock.compare.mockResolvedValue(true);
    });

    it('rechaza el login cuando la ventana de demo ya venció', async () => {
      const { service } = buildService({
        name: 'Nexa Demo',
        plan: 'pro',
        isDemo: true,
        demoExpiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.login('demo@nexacrm.com', 'demo123')).rejects.toThrow(
        new UnauthorizedException(DEMO_EXPIRED_MESSAGE),
      );
    });

    it('deja entrar mientras la ventana sigue abierta y expone el deadline', async () => {
      const demoExpiresAt = new Date(Date.now() + 60_000);
      const { service } = buildService({
        name: 'Nexa Demo',
        plan: 'pro',
        isDemo: true,
        demoExpiresAt,
      });

      const result = (await service.login('demo@nexacrm.com', 'demo123')) as {
        user: { isDemo: boolean; demoExpiresAt: Date | null };
      };

      expect(result.user.isDemo).toBe(true);
      expect(result.user.demoExpiresAt).toEqual(demoExpiresAt);
    });

    it('no bloquea a los tenants que no son demo', async () => {
      const { service } = buildService({
        name: 'Acme',
        plan: 'starter',
        isDemo: false,
        demoExpiresAt: null,
      });

      const result = (await service.login('user@acme.com', 'secret123')) as {
        user: { isDemo: boolean; demoExpiresAt: Date | null };
      };

      expect(result.user.isDemo).toBe(false);
      expect(result.user.demoExpiresAt).toBeNull();
    });
  });

  describe('JwtStrategy.validate', () => {
    const buildStrategy = (organization: Record<string, unknown>) => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-1',
            email: 'demo@nexacrm.com',
            role: 'OWNER',
            organizationId: 'org-1',
            isActive: true,
            organization,
          }),
        },
      };

      return new JwtStrategy(prisma as unknown as PrismaService);
    };

    beforeAll(() => {
      process.env.JWT_SECRET = 'test-secret-long-enough-for-jwt-strategy-validation';
    });

    it('corta la sesión en vivo cuando la demo vence', async () => {
      const strategy = buildStrategy({
        isDemo: true,
        demoExpiresAt: new Date(Date.now() - 1),
      });

      await expect(strategy.validate({ sub: 'user-1' } as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deja pasar la sesión mientras la demo está vigente', async () => {
      const strategy = buildStrategy({
        isDemo: true,
        demoExpiresAt: new Date(Date.now() + 60_000),
      });

      await expect(strategy.validate({ sub: 'user-1' } as any)).resolves.toMatchObject({
        id: 'user-1',
        organizationId: 'org-1',
      });
    });
  });
});
