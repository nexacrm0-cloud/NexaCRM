import { Test, TestingModule } from '@nestjs/testing';
import { Request, Response } from 'express';
import { TenantMiddleware } from '../tenant.middleware';
import { PrismaService } from '@nexa/database';

// Unit tests for the TenantMiddleware's RLS-bound role + org session var
// setup. These do NOT require Postgres: they assert the sequence of
// $executeRawUnsafe calls the middleware issues against a mocked Prisma.
// The end-to-end "RLS actually blocks a cross-tenant SELECT" test lives in
// a separate test class that needs a real Postgres + the migration applied.

const UUID_A = '11111111-1111-1111-1111-111111111111';
const UUID_B = '22222222-2222-2222-2222-222222222222';

describe('TenantMiddleware (RLS role + org session var)', () => {
  const prisma = {
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
  };

  let middleware: TenantMiddleware;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantMiddleware, { provide: PrismaService, useValue: prisma }],
    }).compile();
    middleware = module.get(TenantMiddleware);
    jest.clearAllMocks();
    delete process.env.RLS_APP_ROLE;
  });

  function mkReq(user: any, opts: Partial<Request> = {}): Request {
    return {
      user,
      originalUrl: '/api/v1/clients',
      headers: {},
      ...opts,
    } as unknown as Request;
  }

  const mkRes = (): Response => ({}) as Response;

  it('swaps role AND sets the session var when user is authenticated', async () => {
    const next = jest.fn();
    await middleware.use(mkReq({ organizationId: UUID_A }), mkRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    // Two raw calls: SET ROLE and SELECT set_config(...)
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
    expect(prisma.$executeRawUnsafe.mock.calls[0][0]).toContain('SET ROLE nexa_app');
    expect(prisma.$executeRawUnsafe.mock.calls[1][0]).toContain('set_config');
    expect(prisma.$executeRawUnsafe.mock.calls[1][1]).toBe(UUID_A);
    // Session scope: third arg set to false inside the SQL string.
    expect(prisma.$executeRawUnsafe.mock.calls[1][0]).toMatch(/\bfalse\b/);
  });

  it('rejects a malformed organizationId (not UUIDv4): sets role but uses empty session var', async () => {
    // Suppress the expected warn so jest doesn't print it.
    const warnSpy = jest
      .spyOn(middleware['logger'], 'warn')
      .mockImplementation(() => undefined as void);
    const next = jest.fn();
    await middleware.use(mkReq({ organizationId: 'not-a-uuid' }), mkRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    // Two calls: SET ROLE and set_config('') — the empty var makes RLS
    // treat this as fail-closed (no rows), exactly what we want for a
    // malformed (potentially attacker-controlled) value.
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
    expect(prisma.$executeRawUnsafe.mock.calls[0][0]).toContain('SET ROLE nexa_app');
    expect(prisma.$executeRawUnsafe.mock.calls[1][1]).toBe('');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('swaps role and sets the var to empty string when there is no user (login, webhook)', async () => {
    const next = jest.fn();
    await middleware.use(mkReq(undefined, { originalUrl: '/api/v1/auth/login' }), mkRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    // Two calls: SET ROLE and set_config('')
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
    expect(prisma.$executeRawUnsafe.mock.calls[0][0]).toContain('SET ROLE nexa_app');
    expect(prisma.$executeRawUnsafe.mock.calls[1][0]).toContain('set_config');
    expect(prisma.$executeRawUnsafe.mock.calls[1][1]).toBe('');
  });

  it('honors X-Support-Org-Id ONLY on /api/v1/support/* routes for a SUPER_ADMIN', async () => {
    const next = jest.fn();
    await middleware.use(
      mkReq({ role: 'SUPER_ADMIN', organizationId: UUID_A }, {
        originalUrl: '/api/v1/support/clients',
        headers: { 'x-support-org-id': UUID_B },
      } as any),
      mkRes(),
      next,
    );

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
    expect(prisma.$executeRawUnsafe.mock.calls[1][1]).toBe(UUID_B);
  });

  it('does NOT honor X-Support-Org-Id outside of /api/v1/support/* even for SUPER_ADMIN', async () => {
    const next = jest.fn();
    await middleware.use(
      mkReq({ role: 'SUPER_ADMIN', organizationId: UUID_A }, {
        originalUrl: '/api/v1/clients',
        headers: { 'x-support-org-id': UUID_B },
      } as any),
      mkRes(),
      next,
    );

    // The SUPER_ADMIN's own organizationId wins, not the override header.
    expect(prisma.$executeRawUnsafe.mock.calls[1][1]).toBe(UUID_A);
  });

  it('rethrows when SET ROLE fails (fail-closed — never silently continue without the role)', async () => {
    prisma.$executeRawUnsafe.mockRejectedValueOnce(new Error('role nexa_app does not exist'));
    const next = jest.fn();

    await expect(middleware.use(mkReq({ organizationId: UUID_A }), mkRes(), next)).rejects.toThrow(
      'role nexa_app does not exist',
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rethrows when set_config fails (so a misconfigured role is surfaced, not masked)', async () => {
    // SET ROLE succeeds, but the second call fails. Must re-throw — otherwise
    // downstream queries would run against an unset var and produce a
    // confusing 404 instead of a 500.
    prisma.$executeRawUnsafe
      .mockResolvedValueOnce(0)
      .mockRejectedValueOnce(new Error('app.organization_id not allowed'));
    const next = jest.fn();

    await expect(middleware.use(mkReq({ organizationId: UUID_A }), mkRes(), next)).rejects.toThrow(
      'app.organization_id not allowed',
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('respects the RLS_APP_ROLE env override (operator can rename the role)', async () => {
    process.env.RLS_APP_ROLE = 'nexa_tenant_app';
    const next = jest.fn();
    await middleware.use(mkReq({ organizationId: UUID_A }), mkRes(), next);

    expect(prisma.$executeRawUnsafe.mock.calls[0][0]).toContain('SET ROLE nexa_tenant_app');
  });
});
