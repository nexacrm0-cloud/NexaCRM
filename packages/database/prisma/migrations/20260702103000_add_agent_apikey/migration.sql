-- Add apiKey column to agent_subscriptions (without unique constraint first)
ALTER TABLE "agent_subscriptions" ADD COLUMN "apiKey" TEXT;

-- Generate API keys for existing subscriptions
UPDATE "agent_subscriptions" 
SET "apiKey" = 'ag_' || encode(gen_random_bytes(24), 'hex')
WHERE "apiKey" IS NULL;

-- Make it NOT NULL and add unique constraint
ALTER TABLE "agent_subscriptions" ALTER COLUMN "apiKey" SET NOT NULL;
CREATE UNIQUE INDEX "agent_subscriptions_apiKey_key" ON "agent_subscriptions"("apiKey");