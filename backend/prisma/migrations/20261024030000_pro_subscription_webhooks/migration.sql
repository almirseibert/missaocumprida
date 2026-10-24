-- Assinatura Pro (Google Play via RevenueCat) com estado completo e registro
-- de webhooks recebidos (idempotência + prova). Aditiva e reexecutável.

ALTER TABLE "verified_pro_subscriptions" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'PLAY';
ALTER TABLE "verified_pro_subscriptions" ADD COLUMN IF NOT EXISTS "product_id" TEXT;
ALTER TABLE "verified_pro_subscriptions" ADD COLUMN IF NOT EXISTS "store_transaction_id" TEXT;
ALTER TABLE "verified_pro_subscriptions" ADD COLUMN IF NOT EXISTS "environment" TEXT;
ALTER TABLE "verified_pro_subscriptions" ADD COLUMN IF NOT EXISTS "will_renew" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "verified_pro_subscriptions" ADD COLUMN IF NOT EXISTS "billing_issue_at" TIMESTAMP(3);
ALTER TABLE "verified_pro_subscriptions" ADD COLUMN IF NOT EXISTS "last_event_type" TEXT;
ALTER TABLE "verified_pro_subscriptions" ADD COLUMN IF NOT EXISTS "last_event_at" TIMESTAMP(3);
ALTER TABLE "verified_pro_subscriptions" ADD COLUMN IF NOT EXISTS "granted_by" TEXT;
ALTER TABLE "verified_pro_subscriptions" ADD COLUMN IF NOT EXISTS "grant_reason" TEXT;

CREATE TABLE IF NOT EXISTS "webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "event_type" TEXT,
    "user_id" TEXT,
    "payload" JSONB NOT NULL,
    "signature_valid" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_provider_external_id_key" ON "webhook_events"("provider", "external_id");
CREATE INDEX IF NOT EXISTS "webhook_events_provider_received_at_idx" ON "webhook_events"("provider", "received_at");
CREATE INDEX IF NOT EXISTS "webhook_events_user_id_received_at_idx" ON "webhook_events"("user_id", "received_at");

-- Pro concedido pelo admin sem assinatura na loja passa a ter registro próprio
INSERT INTO "verified_pro_subscriptions" ("id", "user_id", "status", "current_period_end", "monthly_value", "source", "grant_reason")
SELECT md5('admin-pro:' || u."id"), u."id", 'ACTIVE', coalesce(u."verified_pro_expires", now() + interval '30 days'), 0, 'ADMIN', 'Concedido antes do registro de origem'
FROM "users" u
WHERE u."is_verified_pro" = true
  AND NOT EXISTS (SELECT 1 FROM "verified_pro_subscriptions" s WHERE s."user_id" = u."id" AND s."status" = 'ACTIVE')
ON CONFLICT ("id") DO NOTHING;
