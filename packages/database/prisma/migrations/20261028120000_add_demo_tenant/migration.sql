-- Time-boxed sales demo tenants.
--
-- A demo tenant is a whole Organization flagged with `isDemo`. Its access
-- window ends exactly at `demoExpiresAt`; the request path enforces the
-- deadline (login / refresh / JWT validation) and the hourly cron resets the
-- tenant back to the seed fixture so the next prospect starts from clean data.
--
-- The flag lives on the organization (not on individual users) so that every
-- account inside the demo tenant — including ones invited by a prospect —
-- is covered by the same deadline without any chance of divergence.
ALTER TABLE "organizations" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organizations" ADD COLUMN "demoExpiresAt" TIMESTAMP(3);

-- Partial index used by the expiry cron: it only scans demo tenants whose
-- window has already closed.
CREATE INDEX "organizations_demo_window_idx" ON "organizations" ("demoExpiresAt") WHERE "isDemo" = true;
