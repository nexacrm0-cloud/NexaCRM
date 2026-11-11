import { Test, TestingModule } from '@nestjs/testing';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { TenantScopeInterceptor } from '../tenant-scope.interceptor';
import { PrismaService } from '@nexa/database';

// The interceptor binds every AUTHENTICATED request to its tenant for the
// whole request. It runs after the guards (so `req.user` is resolved), and
// the binding itself happens in `PrismaService.runInTenantScope`, which opens
// an interactive transaction with a transaction-scoped RLS context.
//
// These tests assert WHICH tenant id is handed to that method — they do not
// need Postgres.

const CUID_A = 'cmqvd394s00004864glkkikk0';
const UUID_B = '22222222-2222-2222-2222-222222222222';

describe('TenantScopeInterceptor', () => {
  const prisma = {
    runInTenantScope: jest.fn(),
  };

  let interceptor: TenantScopeInterceptor;

  beforeEach(async () => {
    prisma.runInTenantScope.mockImplementation(
      async (_organizationId: string, fn: () => Promise<unknown>) => fn(),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantScopeInterceptor, { provide: PrismaService, useValue: prisma }],
    }).compile();
    interceptor = module.get(TenantScopeInterceptor);
    jest.clearAllMocks();
    prisma.runInTenantScope.mockImplementation(
      async (_organizationId: string, fn: () => Promise<unknown>) => fn(),
    );
  });

  function mkCtx(req: any): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
  }

  function mkReq(user: any, opts: any = {}): any {
    return {
      user,
      originalUrl: '/api/v1/clients',
      url: '/api/v1/clients',
      headers: {},
      ...opts,
    };
  }

  it('binds the tenant of an authenticated request', async () => {
    const next: CallHandler = { handle: () => of({ ok: true }) };
    await new Promise<void>((resolve, reject) => {
      interceptor
        .intercept(mkCtx(mkReq({ organizationId: CUID_A })), next)
        .subscribe({ next: () => resolve(), error: reject });
    });

    expect(prisma.runInTenantScope).toHaveBeenCalledTimes(1);
    expect(prisma.runInTenantScope.mock.calls[0][0]).toBe(CUID_A);
  });

  it('accepts a uuid organizationId', async () => {
    const next: CallHandler = { handle: () => of({ ok: true }) };
    await new Promise<void>((resolve, reject) => {
      interceptor
        .intercept(mkCtx(mkReq({ organizationId: UUID_B })), next)
        .subscribe({ next: () => resolve(), error: reject });
    });

    expect(prisma.runInTenantScope.mock.calls[0][0]).toBe(UUID_B);
  });

  it('does NOT open a tenant scope for unauthenticated routes (login, webhooks)', async () => {
    const next: CallHandler = { handle: () => of({ ok: true }) };
    await new Promise<void>((resolve, reject) => {
      interceptor
        .intercept(mkCtx(mkReq(undefined)), next)
        .subscribe({ next: () => resolve(), error: reject });
    });

    expect(prisma.runInTenantScope).not.toHaveBeenCalled();
  });

  it('binds an empty tenant for a malformed organizationId (fail-closed)', async () => {
    const warnSpy = jest
      .spyOn(interceptor['logger'], 'warn')
      .mockImplementation(() => undefined as void);

    const next: CallHandler = { handle: () => of({ ok: true }) };
    await new Promise<void>((resolve, reject) => {
      interceptor
        .intercept(mkCtx(mkReq({ organizationId: 'not-an-id' })), next)
        .subscribe({ next: () => resolve(), error: reject });
    });

    expect(prisma.runInTenantScope.mock.calls[0][0]).toBe('');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('honors X-Support-Org-Id ONLY on /api/v1/support/* routes for a SUPER_ADMIN', async () => {
    const next: CallHandler = { handle: () => of({ ok: true }) };
    await new Promise<void>((resolve, reject) => {
      interceptor
        .intercept(
          mkCtx(
            mkReq(
              { role: 'SUPER_ADMIN', organizationId: CUID_A },
              {
                originalUrl: '/api/v1/support/clients',
                headers: { 'x-support-org-id': UUID_B },
              },
            ),
          ),
          next,
        )
        .subscribe({ next: () => resolve(), error: reject });
    });

    expect(prisma.runInTenantScope.mock.calls[0][0]).toBe(UUID_B);
  });

  it('does NOT honor X-Support-Org-Id outside of /api/v1/support/* even for SUPER_ADMIN', async () => {
    const next: CallHandler = { handle: () => of({ ok: true }) };
    await new Promise<void>((resolve, reject) => {
      interceptor
        .intercept(
          mkCtx(
            mkReq(
              { role: 'SUPER_ADMIN', organizationId: CUID_A },
              { headers: { 'x-support-org-id': UUID_B } },
            ),
          ),
          next,
        )
        .subscribe({ next: () => resolve(), error: reject });
    });

    expect(prisma.runInTenantScope.mock.calls[0][0]).toBe(CUID_A);
  });

  it('propagates handler errors out of the tenant scope', async () => {
    const boom = new Error('boom');
    const next: CallHandler = { handle: () => of({ ok: true }) };
    prisma.runInTenantScope.mockRejectedValueOnce(boom);

    await expect(
      new Promise<void>((resolve, reject) => {
        interceptor
          .intercept(mkCtx(mkReq({ organizationId: CUID_A })), next)
          .subscribe({ next: () => resolve(), error: reject });
      }),
    ).rejects.toThrow(boom);
  });
});
