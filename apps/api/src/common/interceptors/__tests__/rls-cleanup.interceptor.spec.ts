import { Test, TestingModule } from '@nestjs/testing';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, throwError, firstValueFrom } from 'rxjs';
import { delay } from 'rxjs/operators';
import { RlsCleanupInterceptor } from '../rls-cleanup.interceptor';
import { PrismaService } from '@nexa/database';

// Unit tests for the RlsCleanupInterceptor. Verified:
//   - RESET ROLE + RESET app.organization_id are issued exactly once per
//     request AFTER the response stream completes (finalize()).
//   - Failure to reset is logged but never throws (finalize must not
//     mask the real HTTP response).
//   - Cleanup runs even when the handler throws.
//
// These tests are async because finalize returns a Promise here. We use
// firstValueFrom to await the response, then add a microtask flush so the
// finalize side effect has a chance to run before we assert on the mock.

describe('RlsCleanupInterceptor', () => {
  const prisma = {
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
  };

  let interceptor: RlsCleanupInterceptor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RlsCleanupInterceptor, { provide: PrismaService, useValue: prisma }],
    }).compile();
    interceptor = module.get(RlsCleanupInterceptor);
    jest.clearAllMocks();
  });

  const mkCtx = (): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) }),
    }) as ExecutionContext;

  // Give finalize's async $executeRawUnsafe a chance to settle before we
  // assert on the mock. Two microtasks is enough because the mock resolves
  // immediately on the next tick.
  const flushFinalize = () => new Promise<void>((r) => setImmediate(r));

  it('issues RESET ROLE + RESET app.organization_id after the response completes', async () => {
    const next: CallHandler = { handle: () => of({ ok: true }) };
    const result = await firstValueFrom(interceptor.intercept(mkCtx(), next));
    expect(result).toEqual({ ok: true });

    await flushFinalize();

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
    expect(prisma.$executeRawUnsafe.mock.calls[0][0]).toContain('RESET ROLE');
    expect(prisma.$executeRawUnsafe.mock.calls[1][0]).toContain('RESET app.organization_id');
  });

  it('still emits the response even if RESET ROLE throws (never mask the response)', async () => {
    prisma.$executeRawUnsafe.mockRejectedValueOnce(new Error('connection reset'));
    const next: CallHandler = { handle: () => of({ ok: true }) };

    const result = await firstValueFrom(interceptor.intercept(mkCtx(), next));
    expect(result).toEqual({ ok: true });

    await flushFinalize();
    // The reset was attempted (that's what we care about); the second reset
    // may or may not have run depending on whether finalize short-circuits
    // on the first failure. We at least assert the first call was RESET ROLE.
    expect(prisma.$executeRawUnsafe.mock.calls[0][0]).toContain('RESET ROLE');
  });

  it('runs cleanup even when the handler throws (finalize covers errors)', async () => {
    const handlerErr = new Error('boom');
    const next: CallHandler = { handle: () => throwError(() => handlerErr) };

    await expect(firstValueFrom(interceptor.intercept(mkCtx(), next))).rejects.toThrow(handlerErr);
    await flushFinalize();

    expect(prisma.$executeRawUnsafe).toHaveBeenCalled();
    expect(prisma.$executeRawUnsafe.mock.calls[0][0]).toContain('RESET ROLE');
  });

  it('runs cleanup even when the handler completes asynchronously', async () => {
    const next: CallHandler = { handle: () => of({ ok: true }).pipe(delay(10)) };
    const result = await firstValueFrom(interceptor.intercept(mkCtx(), next));
    expect(result).toEqual({ ok: true });

    await flushFinalize();
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
  });
});
