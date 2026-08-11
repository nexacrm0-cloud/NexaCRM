-- Row Level Security: fail-closed multi-tenant isolation for BUSINESS tables.
--
-- The TenantMiddleware already calls `set_config('app.organization_id', $1,
-- false)` on every authenticated request, so this migration just needs to
-- turn that session variable into a hard database-level enforcement. The
-- motivation: today, isolation depends on every single Prisma call site
-- remembering `where: { organizationId }`. A single forgetful `findFirst`
-- (or a future refactor in a service) leaks another tenant's data. RLS
-- flips the default: a row is invisible unless its `"organizationId"`
-- matches the session var, no matter what the query says.
--
-- Strategy:
--   1. CREATE ROLE nexa_app NOLOGIN NOBYPASSRLS — the role the API process
--      uses at runtime. It has no BYPASSRLS privilege, so every one of its
--      queries is filtered by the policies below.
--   2. CREATE ROLE nexa_admin NOLOGIN BYPASSRLS — the role migrations, seeds
--      and support tooling use. BYPASSRLS opts out of policies entirely, so
--      `prisma migrate deploy`, seed scripts, and ad-hoc ops queries can
--      read/write across tenants (necessary for backfills, schema changes,
--      seeding demo data, etc.).
--   3. ENABLE ROW LEVEL SECURITY + FORCE on every BUSINESS-scoped table.
--      `FORCE` is critical: without it, policies apply only to roles that
--      are NOT the table owner. With FORCE, even the table owner (which is
--      the role used to CREATE TABLE during migrations, i.e. nexa_admin) is
--      subject to the policies — so a stolen migration-role credential
--      cannot query tenant data either.
--   4. Two GRANT sets:
--        GRANT SELECT/INSERT/UPDATE/DELETE TO nexa_app — what the API needs.
--        GRANT ALL TO nexa_admin — for backfills, manual fixes, cleanup.
--   5. Per-table policy `tenant_isolation USING ("organizationId" =
--      current_setting('app.organization_id', true))`. Note the column is
--      physically stored with the Prisma-preserved camelCase name
--      `"organizationId"` (double-quoted), NOT snake_case. The second arg
--      of current_setting() is `missing_ok`; we set it true so an unset var
--      returns '' instead of raising. Since no real org id is '', the
--      comparison is false and the row is filtered — that's our fail-closed
--      behavior for routes where the TenantMiddleware didn't set the var
--      (e.g. /auth/login, which hits `users` before auth).
--
-- Scope — what IS covered (24 tenant tables):
--   activity_logs, agent_executions, agent_subscriptions, api_keys,
--   audit_logs, automation_subscriptions, categories, clients,
--   dashboard_projections, deals, events, invoices, notifications,
--   organization_feature_overrides, pipeline_stages, plugins, products,
--   quotes, search_index, stock_movements, subscriptions, tasks,
--   usage_records, workflow_execution_logs, workflows.
--
-- What is NOT covered (and why):
--   * `users` — login does `findUnique({ where: { email } })` before any
--     tenant is known; register creates the first org+user inside the same
--     $transaction with the session var unset; forgotPassword/resetPassword
--     look up users without an auth context; 2FA + OTP flows all touch
--     users pre-auth. Putting RLS on users would break all of these paths.
--     The app-level `JwtAuthGuard` + the per-service `where: { orgId }`
--     filters still isolate tenant-scoped reads/writes on users after auth.
--   * `organizations` — register creates the org before the user exists
--     (no session var yet), and the slug-uniqueness check (`findUnique`)
--     runs inside the same $transaction. Same rationale as users.
--   * `invitations` — `acceptInvitation` looks up the invitation by token
--     without any session var (the accepting user doesn't exist yet), and
--     the create path inserts into a tenant that isn't the caller's.
--   * `password_reset_tokens`, `email_verification_tokens` — token-based
--     flows have no auth context at all; the token IS the credential.
--   * `whatsapp_processed_messages`, `otp_codes` — nullable org id; they
--     get a special `tenant_isolation_nullable` policy below that allows
--     rows with NULL org only when the session var is unset (legitimate
--     unauthenticated inserts: WhatsApp webhook dedup, OTP creation
--     during login).
--
-- Tables WITHOUT organizationId at all (agents, workflow_templates,
-- feature_flags, product_variants, quote_items, invoice_items) are
-- platform-global or row-level reference data and are intentionally not
-- covered here.

-- ---------------------------------------------------------------------------
-- 1. Roles
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexa_app') THEN
    CREATE ROLE nexa_app NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexa_admin') THEN
    -- BYPASSRLS is what lets migrations, seeds, and the support tooling
    -- write across tenants. Keep this role's password rotated and never
    -- hand it to the API process.
    CREATE ROLE nexa_admin NOLOGIN BYPASSRLS;
  END IF;
END$$;

ALTER ROLE nexa_app NOBYPASSRLS;
ALTER ROLE nexa_admin BYPASSRLS;

-- On Render there is a single DATABASE_URL (the DB owner) for both migrations
-- and the API process. For the TenantMiddleware to SET ROLE nexa_app at
-- runtime (and support tooling to SET ROLE nexa_admin), the DB owner must be a
-- member of these roles. No-op if the owner is already a superuser.
GRANT nexa_app TO nexa_admin;
GRANT nexa_app, nexa_admin TO CURRENT_USER;

-- ---------------------------------------------------------------------------
-- 2. ENABLE ROW LEVEL SECURITY + FORCE on tenant-scoped business tables.
--    Auth/setup tables (users, organizations, invitations, password_reset_*,
--    email_verification_*) are intentionally excluded — see header comment.
-- ---------------------------------------------------------------------------

ALTER TABLE "activity_logs"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_executions"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_subscriptions"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_keys"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "automation_subscriptions"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clients"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dashboard_projections"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deals"                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events"                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "otp_codes"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_feature_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pipeline_stages"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plugins"                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quotes"                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "search_index"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stock_movements"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tasks"                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usage_records"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_processed_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflow_execution_logs"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workflows"                  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "activity_logs"              FORCE ROW LEVEL SECURITY;
ALTER TABLE "agent_executions"           FORCE ROW LEVEL SECURITY;
ALTER TABLE "agent_subscriptions"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "api_keys"                   FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs"                 FORCE ROW LEVEL SECURITY;
ALTER TABLE "automation_subscriptions"   FORCE ROW LEVEL SECURITY;
ALTER TABLE "categories"                 FORCE ROW LEVEL SECURITY;
ALTER TABLE "clients"                    FORCE ROW LEVEL SECURITY;
ALTER TABLE "dashboard_projections"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "deals"                      FORCE ROW LEVEL SECURITY;
ALTER TABLE "events"                     FORCE ROW LEVEL SECURITY;
ALTER TABLE "invoices"                   FORCE ROW LEVEL SECURITY;
ALTER TABLE "notifications"              FORCE ROW LEVEL SECURITY;
ALTER TABLE "otp_codes"                  FORCE ROW LEVEL SECURITY;
ALTER TABLE "organization_feature_overrides" FORCE ROW LEVEL SECURITY;
ALTER TABLE "pipeline_stages"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "plugins"                    FORCE ROW LEVEL SECURITY;
ALTER TABLE "products"                   FORCE ROW LEVEL SECURITY;
ALTER TABLE "quotes"                     FORCE ROW LEVEL SECURITY;
ALTER TABLE "search_index"               FORCE ROW LEVEL SECURITY;
ALTER TABLE "stock_movements"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions"              FORCE ROW LEVEL SECURITY;
ALTER TABLE "tasks"                      FORCE ROW LEVEL SECURITY;
ALTER TABLE "usage_records"              FORCE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_processed_messages" FORCE ROW LEVEL SECURITY;
ALTER TABLE "workflow_execution_logs"   FORCE ROW LEVEL SECURITY;
ALTER TABLE "workflows"                  FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. Policies.
--
-- Column is physically `"organizationId"` (camelCase, double-quoted) because
-- Prisma preserves the model field name in DDL. We must use the exact same
-- quoting in the policy, otherwise Postgres looks for a lower-case
-- `organizationid` and fails with "column does not exist".
-- ---------------------------------------------------------------------------

-- ===== Standard NOT NULL business tables (strict policy) ===================

CREATE POLICY tenant_isolation ON "activity_logs"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "agent_executions"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "agent_subscriptions"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "api_keys"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "audit_logs"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "automation_subscriptions"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "categories"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "clients"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "dashboard_projections"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "deals"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "events"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "invoices"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "notifications"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "organization_feature_overrides"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "pipeline_stages"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "plugins"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "products"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "quotes"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "search_index"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "stock_movements"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "subscriptions"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "tasks"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "usage_records"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "workflow_execution_logs"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

CREATE POLICY tenant_isolation ON "workflows"
  USING ("organizationId" = current_setting('app.organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.organization_id', true));

-- ===== Nullable tenant tables (controlled hole for unauthenticated paths) ==
-- These two tables legitimately receive INSERTs from paths without an
-- authenticated user:
--   * POST /webhooks/whatsapp/incoming inserts a dedup row before any
--     user context exists (the webhook authenticates via HMAC, not a user).
--   * OTP creation happens mid-login before the user is authed.
-- The TenantMiddleware sets the session var to '' on those paths. Our
-- policy therefore allows:
--   - Rows whose "organizationId" matches the session var (normal authed
--     path).
--   - Rows where "organizationId" IS NULL AND the session var is '' (the
--     documented unauthenticated insert paths).
--
-- This intentionally means an attacker holding nexa_app can SELECT NULL-org
-- rows from these two tables. We accept the trade: the rows carry no
-- cross-tenant PII while in the NULL state (whatsapp_processed has only
-- messageId + phone + processedAt; otp_codes has email + code + purpose).
-- When WhatsAppService.handleIncomingMessage later backfills
-- "organizationId", the row becomes visible only to the right tenant.

CREATE POLICY tenant_isolation_nullable ON "whatsapp_processed_messages"
  USING (
    "organizationId" = current_setting('app.organization_id', true)
    OR ("organizationId" IS NULL AND current_setting('app.organization_id', true) = '')
  )
  WITH CHECK (
    "organizationId" = current_setting('app.organization_id', true)
    OR ("organizationId" IS NULL AND current_setting('app.organization_id', true) = '')
  );

CREATE POLICY tenant_isolation_nullable ON "otp_codes"
  USING (
    "organizationId" = current_setting('app.organization_id', true)
    OR ("organizationId" IS NULL AND current_setting('app.organization_id', true) = '')
  )
  WITH CHECK (
    "organizationId" = current_setting('app.organization_id', true)
    OR ("organizationId" IS NULL AND current_setting('app.organization_id', true) = '')
  );

-- ---------------------------------------------------------------------------
-- 4. GRANTs.
--
-- nexa_app: only what the API needs at runtime. NO BYPASSRLS, NO CREATE,
-- NO DROP, NO ALTER — the API is read/write only, schema changes go
-- through nexa_admin during migrate.
--
-- nexa_admin: full privileges for migrations, seeds, support queries.
-- BYPASSRLS already covers cross-tenant reads/writes.
--
-- REVOKE ... FROM PUBLIC collapses any inherited over-broad access
-- (defense-in-depth).
-- ---------------------------------------------------------------------------

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO nexa_app, nexa_admin;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nexa_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO nexa_admin;

-- USAGE on sequences for INSERTs that use DEFAULT (cuid() is generated in
-- the app layer, so this is mainly for quote_number_seq).
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nexa_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO nexa_admin;

-- ---------------------------------------------------------------------------
-- 5. DEFAULT PRIVILEGES for future tables.
--
-- Any new table created by nexa_admin (i.e. during future migrations) will
-- automatically get the same GRANTs, so the operator doesn't need to
-- remember to add them per-migration.
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE nexa_admin IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nexa_app;
ALTER DEFAULT PRIVILEGES FOR ROLE nexa_admin IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO nexa_admin;
ALTER DEFAULT PRIVILEGES FOR ROLE nexa_admin IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO nexa_app;
ALTER DEFAULT PRIVILEGES FOR ROLE nexa_admin IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO nexa_admin;

-- ---------------------------------------------------------------------------
-- 6. Defense-in-depth: enable RLS on activity_logs partitions too.
--
-- In PostgreSQL <15, ENABLE ROW LEVEL SECURITY on a partitioned parent
-- does not propagate to existing partitions. In 15+ it does, but the prod
-- image is postgres:16-alpine (PG 16), so this is a no-op there. We run
-- it anyway so we're safe if a manual downgrade or a different image
-- ever ships.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  part TEXT;
BEGIN
  FOR part IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename LIKE 'activity_logs_%'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', part);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', part);
  END LOOP;
END$$;
