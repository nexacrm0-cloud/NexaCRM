-- ============================================================
-- RLS (Row-Level Security) para multi-tenancy
-- Ejecutar después de la migración de Prisma
-- ============================================================

-- Quote number sequence (atómico)
CREATE SEQUENCE IF NOT EXISTS quote_number_seq START 1;

-- ============================================================
-- RLS Policies
-- ============================================================

-- Habilitar RLS en todas las tablas con organizationId
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_feature_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugins ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_projections ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Políticas de tenant isolation
-- Cada política usa current_setting('app.organization_id')
-- seteado por TenantMiddleware en cada request.
-- Para organizations, la política permite ver SOLO la propia org.
-- ============================================================

CREATE POLICY tenant_isolation ON organizations
  USING (id = current_setting('app.organization_id')::text);

CREATE POLICY tenant_isolation ON users
  USING ("organizationId" = current_setting('app.organization_id')::text);

CREATE POLICY tenant_isolation ON clients
  USING ("organizationId" = current_setting('app.organization_id')::text);

CREATE POLICY tenant_isolation ON pipeline_stages
  USING ("organizationId" = current_setting('app.organization_id')::text);

CREATE POLICY tenant_isolation ON deals
  USING ("organizationId" = current_setting('app.organization_id')::text);

CREATE POLICY tenant_isolation ON tasks
  USING ("organizationId" = current_setting('app.organization_id')::text);

CREATE POLICY tenant_isolation ON quotes
  USING ("organizationId" = current_setting('app.organization_id')::text);

CREATE POLICY tenant_isolation ON quote_items
  USING ("quoteId" IN (
    SELECT id FROM quotes WHERE "organizationId" = current_setting('app.organization_id')::text
  ));

CREATE POLICY tenant_isolation ON activity_logs
  USING ("organizationId" = current_setting('app.organization_id')::text);

CREATE POLICY tenant_isolation ON audit_logs
  USING ("organizationId" = current_setting('app.organization_id')::text);

CREATE POLICY tenant_isolation ON search_index
  USING ("organizationId" = current_setting('app.organization_id')::text);

CREATE POLICY tenant_isolation ON workflows
  USING ("organizationId" = current_setting('app.organization_id')::text);

CREATE POLICY tenant_isolation ON workflow_execution_logs
  USING ("organizationId" = current_setting('app.organization_id')::text);

CREATE POLICY tenant_isolation ON subscriptions
  USING ("organizationId" = current_setting('app.organization_id')::text);

CREATE POLICY tenant_isolation ON usage_records
  USING ("organizationId" = current_setting('app.organization_id')::text);

CREATE POLICY tenant_isolation ON organization_feature_overrides
  USING ("organizationId" = current_setting('app.organization_id')::text);

CREATE POLICY tenant_isolation ON plugins
  USING ("organizationId" = current_setting('app.organization_id')::text);

CREATE POLICY tenant_isolation ON agent_subscriptions
  USING ("organizationId" = current_setting('app.organization_id')::text);

CREATE POLICY tenant_isolation ON agent_executions
  USING ("organizationId" = current_setting('app.organization_id')::text);

CREATE POLICY tenant_isolation ON dashboard_projections
  USING ("organizationId" = current_setting('app.organization_id')::text);

-- feature_flags no tiene organizationId, visible para todos
-- (los overrides se filtran por org via RLS en organization_feature_overrides)

-- ============================================================
-- Política especial para la tabla organizations:
-- Un usuario puede ver su propia organización.
-- ============================================================
DROP POLICY IF EXISTS tenant_isolation ON organizations;
CREATE POLICY tenant_isolation ON organizations
  USING (id = current_setting('app.organization_id')::text);

-- ============================================================
-- Nota: RLS requiere que el usuario de BD tenga permisos.
-- El usuario 'nexa' (dueño de las tablas) no es afectado por RLS.
-- En producción, crear un rol de aplicación y usar SET ROLE.
-- ============================================================
