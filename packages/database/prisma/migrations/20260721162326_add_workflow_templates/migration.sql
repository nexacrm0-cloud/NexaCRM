-- Marketplace of reusable workflow templates.
-- Each template can be installed into an organization's workspace to
-- create a concrete Workflow bound to the template's trigger + defaults.

CREATE TABLE IF NOT EXISTS workflow_templates (
    "id" TEXT PRIMARY KEY,
    "slug" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "longDescription" TEXT,
    "category" TEXT NOT NULL,
    "icon" TEXT,
    "trigger" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "paramSchema" JSONB NOT NULL,
    "defaultConfig" JSONB NOT NULL,
    "isFeatured" BOOLEAN NOT NULL DEFAULT FALSE,
    "isPublished" BOOLEAN NOT NULL DEFAULT TRUE,
    "installCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflow_templates_category
    ON workflow_templates("category");

CREATE INDEX IF NOT EXISTS idx_workflow_templates_published_featured
    ON workflow_templates("isPublished", "isFeatured");
