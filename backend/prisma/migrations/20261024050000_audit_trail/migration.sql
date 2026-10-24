-- Rastreabilidade: eventos de auditoria, registros de acesso e extrato do
-- saldo do prestador. Aditiva e reexecutável.

-- CreateTable
CREATE TABLE IF NOT EXISTS "audit_events" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_role" TEXT,
    "user_id" TEXT,
    "counterpart_id" TEXT,
    "order_id" TEXT,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "amount" DOUBLE PRECISION,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "reason" TEXT,
    "request_id" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "device_id" TEXT,
    "app_version" TEXT,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "access_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" TEXT,
    "event" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "device_id" TEXT,
    "app_version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "provider_balance_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balance_after" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "ref_type" TEXT,
    "ref_id" TEXT,
    "actor_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_balance_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_events_user_id_created_at_idx" ON "audit_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_events_counterpart_id_created_at_idx" ON "audit_events"("counterpart_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_events_order_id_created_at_idx" ON "audit_events"("order_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_events_actor_id_created_at_idx" ON "audit_events"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_events_entity_type_entity_id_created_at_idx" ON "audit_events"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_events_type_created_at_idx" ON "audit_events"("type", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "access_logs_user_id_created_at_idx" ON "access_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "access_logs_created_at_idx" ON "access_logs"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "provider_balance_transactions_user_id_created_at_idx" ON "provider_balance_transactions"("user_id", "created_at");


-- Saldo de abertura do extrato: o saldo atual de cada prestador vira a
-- primeira linha (movimentos anteriores não tinham registro).
INSERT INTO "provider_balance_transactions" ("id", "user_id", "amount", "balance_after", "reason", "note")
SELECT md5('opening:' || u."id"), u."id", u."provider_balance", u."provider_balance", 'OPENING_BALANCE',
       'Saldo existente quando o extrato foi criado'
FROM "users" u
WHERE u."provider_balance" <> 0
  AND NOT EXISTS (SELECT 1 FROM "provider_balance_transactions" t WHERE t."user_id" = u."id")
ON CONFLICT ("id") DO NOTHING;
