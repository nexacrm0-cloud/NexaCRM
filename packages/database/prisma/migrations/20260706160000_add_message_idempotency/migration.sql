-- Idempotency table for WhatsApp webhook messages
-- Stores messageId and timestamp so duplicate webhook deliveries from Meta
-- can be detected and short-circuited.

CREATE TABLE IF NOT EXISTS whatsapp_processed_messages (
    "id" TEXT PRIMARY KEY,
    "messageId" TEXT NOT NULL UNIQUE,
    "organizationId" TEXT,
    "from" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_processed_messages_processedAt
    ON "whatsapp_processed_messages"("processedAt");
