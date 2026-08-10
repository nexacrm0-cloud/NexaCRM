-- Convertir activity_logs en tabla particionada por mes (review gate items 1.3 / 5.1)
-- Estrategia: crear tabla nueva particionada, copiar datos, reemplazar por nombre.
-- Compatibilidad Prisma: Prisma no modela PARTITION BY en schema DSL, pero
-- puede leer y escribir tablas particionadas que exponen PK que incluye la partition key.

-- 1. Nueva tabla particionada por rango mensual sobre createdAt
CREATE TABLE "activity_logs_new" (
  "id"             TEXT         NOT NULL,
  "type"           "ActivityType" NOT NULL,
  "description"   TEXT         NOT NULL,
  "metadata"      JSONB,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "organizationId" TEXT        NOT NULL,
  "userId"        TEXT         NOT NULL,
  "clientId"      TEXT,
  "dealId"        TEXT,
  "taskId"        TEXT,
  "quoteId"       TEXT,
  PRIMARY KEY ("id", "createdAt")
) PARTITION BY RANGE ("createdAt");

-- 2. Particiones mensuales: próximas 24 (ago 2026 - jul 2028)
CREATE TABLE "activity_logs_2026_08" PARTITION OF "activity_logs_new"
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE "activity_logs_2026_09" PARTITION OF "activity_logs_new"
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE "activity_logs_2026_10" PARTITION OF "activity_logs_new"
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE "activity_logs_2026_11" PARTITION OF "activity_logs_new"
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE "activity_logs_2026_12" PARTITION OF "activity_logs_new"
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE "activity_logs_2027_01" PARTITION OF "activity_logs_new"
  FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE "activity_logs_2027_02" PARTITION OF "activity_logs_new"
  FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
CREATE TABLE "activity_logs_2027_03" PARTITION OF "activity_logs_new"
  FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');
CREATE TABLE "activity_logs_2027_04" PARTITION OF "activity_logs_new"
  FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');
CREATE TABLE "activity_logs_2027_05" PARTITION OF "activity_logs_new"
  FOR VALUES FROM ('2027-05-01') TO ('2027-06-01');
CREATE TABLE "activity_logs_2027_06" PARTITION OF "activity_logs_new"
  FOR VALUES FROM ('2027-06-01') TO ('2027-07-01');
CREATE TABLE "activity_logs_2027_07" PARTITION OF "activity_logs_new"
  FOR VALUES FROM ('2027-07-01') TO ('2027-08-01');
CREATE TABLE "activity_logs_2027_08" PARTITION OF "activity_logs_new"
  FOR VALUES FROM ('2027-08-01') TO ('2027-09-01');
CREATE TABLE "activity_logs_2027_09" PARTITION OF "activity_logs_new"
  FOR VALUES FROM ('2027-09-01') TO ('2027-10-01');
CREATE TABLE "activity_logs_2027_10" PARTITION OF "activity_logs_new"
  FOR VALUES FROM ('2027-10-01') TO ('2027-11-01');
CREATE TABLE "activity_logs_2027_11" PARTITION OF "activity_logs_new"
  FOR VALUES FROM ('2027-11-01') TO ('2027-12-01');
CREATE TABLE "activity_logs_2027_12" PARTITION OF "activity_logs_new"
  FOR VALUES FROM ('2027-12-01') TO ('2028-01-01');
CREATE TABLE "activity_logs_2028_01" PARTITION OF "activity_logs_new"
  FOR VALUES FROM ('2028-01-01') TO ('2028-02-01');
CREATE TABLE "activity_logs_2028_02" PARTITION OF "activity_logs_new"
  FOR VALUES FROM ('2028-02-01') TO ('2028-03-01');
CREATE TABLE "activity_logs_2028_03" PARTITION OF "activity_logs_new"
  FOR VALUES FROM ('2028-03-01') TO ('2028-04-01');
CREATE TABLE "activity_logs_2028_04" PARTITION OF "activity_logs_new"
  FOR VALUES FROM ('2028-04-01') TO ('2028-05-01');
CREATE TABLE "activity_logs_2028_05" PARTITION OF "activity_logs_new"
  FOR VALUES FROM ('2028-05-01') TO ('2028-06-01');
CREATE TABLE "activity_logs_2028_06" PARTITION OF "activity_logs_new"
  FOR VALUES FROM ('2028-06-01') TO ('2028-07-01');
CREATE TABLE "activity_logs_2028_07" PARTITION OF "activity_logs_new"
  FOR VALUES FROM ('2028-07-01') TO ('2028-08-01');

-- Partición default para fechas fuera de rango (catch-all, evita errores de insert)
CREATE TABLE "activity_logs_default" PARTITION OF "activity_logs_new" DEFAULT;

-- 3. Índices en cada partición (PostgreSQL no permite índices globales en tablas particionadas)
CREATE INDEX ON "activity_logs_new" ("organizationId", "createdAt");
CREATE INDEX ON "activity_logs_new" ("userId");
CREATE INDEX ON "activity_logs_new" ("clientId");
CREATE INDEX ON "activity_logs_new" ("dealId");
CREATE INDEX ON "activity_logs_new" ("createdAt");

-- 4. FK constraints (deben recrearse tras rename)
ALTER TABLE "activity_logs_new"
  ADD CONSTRAINT "activity_logs_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE;
ALTER TABLE "activity_logs_new"
  ADD CONSTRAINT "activity_logs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id");
ALTER TABLE "activity_logs_new"
  ADD CONSTRAINT "activity_logs_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL;
ALTER TABLE "activity_logs_new"
  ADD CONSTRAINT "activity_logs_dealId_fkey"
  FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE SET NULL;
ALTER TABLE "activity_logs_new"
  ADD CONSTRAINT "activity_logs_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL;
ALTER TABLE "activity_logs_new"
  ADD CONSTRAINT "activity_logs_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL;

-- 5. Migrar datos existentes
INSERT INTO "activity_logs_new" ("id", "type", "description", "metadata", "createdAt", "organizationId", "userId", "clientId", "dealId", "taskId", "quoteId")
SELECT "id", "type", "description", "metadata", "createdAt", "organizationId", "userId", "clientId", "dealId", "taskId", "quoteId"
FROM "activity_logs";

-- 6. Drop vieja y rename. Antes de drop, eliminar FKs salientes y la tabla.
ALTER TABLE "activity_logs" DROP CONSTRAINT IF EXISTS "activity_logs_organizationId_fkey";
ALTER TABLE "activity_logs" DROP CONSTRAINT IF EXISTS "activity_logs_userId_fkey";
ALTER TABLE "activity_logs" DROP CONSTRAINT IF EXISTS "activity_logs_clientId_fkey";
ALTER TABLE "activity_logs" DROP CONSTRAINT IF EXISTS "activity_logs_dealId_fkey";
ALTER TABLE "activity_logs" DROP CONSTRAINT IF EXISTS "activity_logs_taskId_fkey";
ALTER TABLE "activity_logs" DROP CONSTRAINT IF EXISTS "activity_logs_quoteId_fkey";
DROP TABLE "activity_logs";
ALTER TABLE "activity_logs_new" RENAME TO "activity_logs";

-- Nota para el operador: el job mensual que crea nuevas particiones
-- puede correr via cron diario verificando la existencia de la proxima
-- particion con `pg_partman` o un script SQL que mantenga el set.
