-- Make createdById nullable in tasks and quotes for agent-created records
ALTER TABLE "tasks" ALTER COLUMN "createdById" DROP NOT NULL;
ALTER TABLE "quotes" ALTER COLUMN "createdById" DROP NOT NULL;