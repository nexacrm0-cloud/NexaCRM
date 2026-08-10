-- Audit + private template flags for automation transfers.
ALTER TABLE workflow_templates
    ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE workflows
    ADD COLUMN "sourceTemplateSlug" TEXT;
