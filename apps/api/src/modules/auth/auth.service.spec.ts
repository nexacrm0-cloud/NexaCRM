import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '@nexa/database';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { TwoFactorService } from './two-factor.service';
import { EventBusService } from '../../event-bus/event-bus.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('AuthService', () => {
  let service: AuthService;

  const mockTwoFactorService = {
    generateSecret: jest.fn(),
    verifyAndEnable: jest.fn(),
    disable: jest.fn(),
    validateCode: jest.fn(),
  };

  const mockEventBus = { emit: jest.fn() };

  const mockNotifications = { sendEmailVerificationEmail: jest.fn(), sendWelcomeEmail: jest.fn() };

  const mockTx = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    organization: {
      create: jest.fn(),
      findUnique: jest.fn(), // called in the slug-uniqueness loop inside register
    },
    pipelineStage: { create: jest.fn() },
    // The register flow calls tx.$executeRawUnsafe to bind the RLS
    // organization_id session var before creating tenant-scoped rows
    // (pipeline_stages). Without this stub the test crashes inside the
    // transaction callback with `tx.$executeRawUnsafe is not a function`.
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
  };
  const mockPrisma = {
    ...mockTx,
    $transaction: jest.fn((cb: any) => cb(mockTx)),
    emailVerificationToken: { create: jest.fn().mockResolvedValue({ id: 'evt-1' }) },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: TwoFactorService, useValue: mockTwoFactorService },
        { provide: EventBusService, useValue: mockEventBus },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should throw ConflictException if email exists', async () => {
      mockTx.user.findUnique.mockResolvedValue({ id: 'existing' });
      await expect(
        service.register({
          email: 'test@test.com',
          password: 'password123',
          firstName: 'Test',
          lastName: 'User',
          organizationName: 'Test Org',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should register a new user and organization', async () => {
      mockTx.user.findUnique.mockResolvedValue(null);
      mockTx.organization.create.mockResolvedValue({ id: 'org-1' });
      mockTx.organization.findUnique.mockResolvedValue(null); // slug always unique
      mockTx.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'OWNER',
        organizationId: 'org-1',
        organization: { name: 'Test Org' },
      });
      mockTx.pipelineStage.create.mockResolvedValue(undefined);
      // Outer prisma user.update for refreshToken after txn:
      mockPrisma.user.update.mockResolvedValue({});
      mockJwtService.signAsync.mockResolvedValue('mock-token');

      const result = await service.register({
        email: 'test@test.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        organizationName: 'Test Org',
      });

      expect(result.user.email).toBe('test@test.com');
      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login('test@test.com', 'wrong')).rejects.toThrow(UnauthorizedException);
    });
  });
});
