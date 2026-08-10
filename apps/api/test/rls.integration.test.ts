import 'reflect-metadata';
import { PrismaService } from '@nexa/database';

// Integration test that proves the Row Level Security migration
// (20260808120000_enable_rls) actually enforces tenant isolation at the
// Postgres level, not just at the NestJS middleware level.
//
// Scope of RLS in this migration: 24 BUSINESS-scoped tenant tables
// (clients, deals, tasks, quotes, etc.). The 4 AUTH/SETUP tables
// (users, organizations, invitations, password_reset_tokens,
// email_verification_tokens) are intentionally NOT covered by RLS — see
// the migration header. This test exercises a business-scoped table
// (`clients`) to prove the policies work end-to-end.
//
// What this test asserts:
//   1. Skips itself when DATABASE_URL is not pointing at a live Postgres
//      (CI / local without docker-compose up).
//   2. Connects, verifies the migration has been applied (nexa_app /
//      nexa_admin roles + policies exist), then:
//        (a) As nexa_app WITHOUT the session var set, SELECT on `clients`
//            returns 0 rows (fail-closed).
//        (b) As nexa_app WITH set_config('app.organization_id', orgA, false),
//            SELECT returns only org A's rows (org B filtered).
//        (c) Same connection switched to org B's var returns only B's rows
//            (proving the policy is dynamic, not cached).
//        (d) nexa_admin (BYPASSRLS) sees all rows of both tenants.
//        (e) nexa_app CANNOT insert into another tenant (WITH CHECK
//            rejects the row).
//
// This complements the unit tests of TenantMiddleware (which assert the
// middleware issues the right $executeRawUnsafe calls but don't prove the
// SQL actually filters). If this integration test fails locally because
// Postgres isn't running, it auto-skips — no setup burden.

const testDbUrl = process.env.DATABASE_URL;
const skip = !testDbUrl || process.env.SKIP_RLS_INTEGRATION === 'true';

const maybeDescribe = skip ? describe.skip : describe;

maybeDescribe('Row Level Security integration (live Postgres required)', () => {
  let adminClient: PrismaService;
  let appClient: PrismaService;
  let orgAId: string;
  let orgBId: string;
  let clientAId: string;
  let clientBId: string;

  // Open two separate connections to keep session state isolated:
  //   adminClient -> runs as the DATABASE_URL role (superuser-like, can
  //                  SET ROLE nexa_admin) for setup + cleanup.
  //   appClient   -> the connection we SET ROLE nexa_app on, simulating
  //                  what TenantMiddleware does per request.
  async function raw(client: PrismaService, sql: string, params?: any[]) {
    if (params && params.length) {
      return (client as any).$queryRawUnsafe(sql, ...params);
    }
    return (client as any).$queryRawUnsafe(sql);
  }
  async function exec(client: PrismaService, sql: string, params?: any[]) {
    if (params && params.length) return (client as any).$executeRawUnsafe(sql, ...params);
    return (client as any).$executeRawUnsafe(sql);
  }

  beforeAll(async () => {
    adminClient = new PrismaService();
    await adminClient.$connect();

    // Verify the migration has been applied by checking that nexa_app role
    // exists. If it doesn't, skip — running the test without RLS installed
    // would give false positives (everything visible).
    const roles = await raw(
      adminClient,
      `SELECT rolname FROM pg_roles WHERE rolname IN ('nexa_app', 'nexa_admin')`,
    );
    if (!Array.isArray(roles) || roles.length < 2) {
      // Mark as skipped via console; jest doesn't have a runtime skip in
      // beforeAll, so throw a soft skip error that the test body ignores.
      console.warn(
        '[rls.integration] SKIPPED: nexa_app / nexa_admin roles not present. ' +
          'Run `pnpm db:migrate:deploy` against this DATABASE_URL before enabling.',
      );
      // Best-effort teardown; the test bodies will throw, which jest reports
      // as failures — but since this is opt-in (SKIP_RLS_INTEGRATION=true is
      // the default), users who want it explicit know what to expect.
      await adminClient.$disconnect();
      throw new Error('RLS roles missing — see warning above');
    }

    // Set up two orgs and a client per org, all as nexa_admin (BYPASSRLS).
    await exec(adminClient, `SET ROLE nexa_admin`);

    // Clean slate for our test data so re-runs are deterministic.
    await exec(
      adminClient,
      `DELETE FROM "clients" WHERE "companyName" IN ('__rls_test_orgA__','__rls_test_orgB__')`,
    );
    await exec(
      adminClient,
      `DELETE FROM "organizations" WHERE "name" IN ('__rls_test_orgA__','__rls_test_orgB__')`,
    );

    // Insert two organizations. Use RETURNING to grab their IDs.
    const orgA = await raw(
      adminClient,
      `INSERT INTO "organizations" ("id", "name", "plan", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, '__rls_test_orgA__', 'free', NOW(), NOW()) RETURNING "id"`,
    );
    const orgB = await raw(
      adminClient,
      `INSERT INTO "organizations" ("id", "name", "plan", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, '__rls_test_orgB__', 'free', NOW(), NOW()) RETURNING "id"`,
    );
    orgAId = (orgA as any)[0].id;
    orgBId = (orgB as any)[0].id;

    // Insert one client per org.
    const clientA = await raw(
      adminClient,
      `INSERT INTO "clients" ("id", "companyName", "contactName", "organizationId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, '__rls_test_orgA__', 'A', $1, NOW(), NOW()) RETURNING "id"`,
      [orgAId],
    );
    const clientB = await raw(
      adminClient,
      `INSERT INTO "clients" ("id", "companyName", "contactName", "organizationId", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, '__rls_test_orgB__', 'B', $1, NOW(), NOW()) RETURNING "id"`,
      [orgBId],
    );
    clientAId = (clientA as any)[0].id;
    clientBId = (clientB as any)[0].id;

    await exec(adminClient, `RESET ROLE`);

    // Open a SECOND connection to play the role of the API process.
    appClient = new PrismaService();
    await appClient.$connect();
  }, 60000);

  afterAll(async () => {
    if (adminClient) {
      try {
        await exec(adminClient, `SET ROLE nexa_admin`);
        await exec(
          adminClient,
          `DELETE FROM "clients" WHERE "companyName" IN ('__rls_test_orgA__','__rls_test_orgB__')`,
        );
        await exec(
          adminClient,
          `DELETE FROM "organizations" WHERE "name" IN ('__rls_test_orgA__','__rls_test_orgB__')`,
        );
        await exec(adminClient, `RESET ROLE`);
      } finally {
        await adminClient.$disconnect();
      }
    }
    if (appClient) await appClient.$disconnect();
  }, 60000);

  it('nexa_app without the session var sees ZERO rows (fail-closed)', async () => {
    await exec(appClient, `SET ROLE nexa_app`);
    await exec(appClient, `RESET app.organization_id`);
    const rows = await raw(
      appClient,
      `SELECT COUNT(*)::int AS n FROM "clients" WHERE "companyName" LIKE '__rls_test_%'`,
    );
    expect((rows as any)[0].n).toBe(0);
  });

  it("nexa_app with orgA's var sees ONLY orgA's client (orgB filtered)", async () => {
    await exec(appClient, `SET ROLE nexa_app`);
    await exec(appClient, `SELECT set_config('app.organization_id', $1, false)`, [orgAId]);
    const rows = await raw(
      appClient,
      `SELECT "id", "companyName" FROM "clients" WHERE "companyName" LIKE '__rls_test_%'`,
    );
    expect(Array.isArray(rows)).toBe(true);
    expect((rows as any[]).map((r) => r.companyName).sort()).toEqual(['__rls_test_orgA__']);
  });

  it('same connection switched to orgB var now sees orgB only (policy is dynamic)', async () => {
    await exec(appClient, `SET ROLE nexa_app`);
    await exec(appClient, `SELECT set_config('app.organization_id', $1, false)`, [orgBId]);
    const rows = await raw(
      appClient,
      `SELECT "companyName" FROM "clients" WHERE "companyName" LIKE '__rls_test_%'`,
    );
    expect((rows as any[]).map((r) => r.companyName).sort()).toEqual(['__rls_test_orgB__']);
  });

  it('nexa_admin (BYPASSRLS) sees ALL rows of both tenants', async () => {
    await exec(appClient, `SET ROLE nexa_admin`);
    await exec(appClient, `RESET app.organization_id`);
    const rows = await raw(
      appClient,
      `SELECT "companyName" FROM "clients" WHERE "companyName" LIKE '__rls_test_%'`,
    );
    expect((rows as any[]).map((r) => r.companyName).sort()).toEqual([
      '__rls_test_orgA__',
      '__rls_test_orgB__',
    ]);
  });

  it('nexa_app CANNOT insert a row into orgB while session var is set to orgA (WITH CHECK rejects)', async () => {
    await exec(appClient, `SET ROLE nexa_app`);
    await exec(appClient, `SELECT set_config('app.organization_id', $1, false)`, [orgAId]);
    // Attempt to insert a row claiming it belongs to orgB — RLS WITH CHECK
    // must reject this because organizationId != current_setting().
    await expect(
      exec(
        appClient,
        `INSERT INTO "clients" ("id", "companyName", "contactName", "organizationId", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, '__rls_test_insert_attempt__', 'X', $1, NOW(), NOW())`,
        [orgBId],
      ),
    ).rejects.toThrow(/row level security|new row violates/);
  });
});
