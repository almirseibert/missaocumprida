-- Revisão pós-Play (fase 2): fotos em todos os serviços, perguntas sem
-- repetição, provas preservadas e índices.
-- Aditiva e reexecutável (IF NOT EXISTS): o histórico do banco tem tabelas
-- criadas por `db push`, então nada aqui pressupõe estado exato.

-- ---------------------------------------------------------------------------
-- 1. Colunas novas
-- ---------------------------------------------------------------------------
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "description_hint" TEXT;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "description_required" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "photo_hint" TEXT;

ALTER TABLE "questionnaire_fields" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "client_request_id" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "public_share_photos" BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 2. Fotos do serviço (check-in / conclusão, várias por etapa)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "OrderPhotoStage" AS ENUM ('ORDER', 'CHECKIN', 'COMPLETION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "order_photos" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "schedule_id" TEXT,
    "stage" "OrderPhotoStage" NOT NULL,
    "media_type" TEXT NOT NULL DEFAULT 'IMAGE',
    "url" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_photos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "order_photos_order_id_stage_created_at_idx" ON "order_photos"("order_id", "stage", "created_at");
DO $$ BEGIN
  ALTER TABLE "order_photos" ADD CONSTRAINT "order_photos_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Fotos de check-in/conclusão que já existiam (uma por etapa) entram na galeria
INSERT INTO "order_photos" ("id", "order_id", "schedule_id", "stage", "url", "uploaded_by", "latitude", "longitude", "created_at")
SELECT 'legacy-ck-' || s."id", s."order_id", s."id", 'CHECKIN', s."checkin_photo_url", s."provider_id", s."checkin_lat", s."checkin_lng", coalesce(s."checkin_at", s."created_at")
FROM "schedules" s WHERE s."checkin_photo_url" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;
INSERT INTO "order_photos" ("id", "order_id", "schedule_id", "stage", "url", "uploaded_by", "latitude", "longitude", "created_at")
SELECT 'legacy-done-' || s."id", s."order_id", s."id", 'COMPLETION', s."complete_photo_url", s."provider_id", s."complete_lat", s."complete_lng", coalesce(s."done_at", s."created_at")
FROM "schedules" s WHERE s."complete_photo_url" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Arquivo de agendamentos desfeitos (prova do chat/avaliações)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "schedule_archives" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_by" TEXT,
    CONSTRAINT "schedule_archives_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "schedule_archives_order_id_idx" ON "schedule_archives"("order_id");
CREATE INDEX IF NOT EXISTS "schedule_archives_provider_id_idx" ON "schedule_archives"("provider_id");
CREATE INDEX IF NOT EXISTS "schedule_archives_client_id_idx" ON "schedule_archives"("client_id");

-- ---------------------------------------------------------------------------
-- 4. Catálogo: fotos opcionais e sem perguntas repetindo o formulário
-- ---------------------------------------------------------------------------
-- 4a. Fotos: o formulário tem um bloco de fotos (opcional) em TODAS as
--     categorias. O texto das antigas perguntas de foto vira a dica do bloco.
UPDATE "categories" c SET "photo_hint" = sub.hint
FROM (
  SELECT "category_id", string_agg("question", ' · ' ORDER BY "order", "question") AS hint
  FROM "questionnaire_fields" WHERE "field_type" = 'PHOTO' GROUP BY "category_id"
) sub
WHERE c."id" = sub."category_id" AND c."photo_hint" IS NULL;

UPDATE "questionnaire_fields" SET "is_active" = false, "is_required" = false WHERE "field_type" = 'PHOTO';

-- 4b. Sim/Não nunca é obrigatório (deixar desmarcado = "Não")
UPDATE "questionnaire_fields" SET "is_required" = false WHERE "field_type" = 'BOOLEAN';

-- 4c. "É urgente?" repete o seletor de urgência do formulário
UPDATE "questionnaire_fields" f SET "is_active" = false, "is_required" = false
FROM "categories" c
WHERE f."category_id" = c."id"
  AND c."slug" IN ('encanador', 'chaveiro', 'chaveiro-automotivo', 'motoboy', 'recuperacao-dados',
                   'eletrica-automotiva', 'despachante-documentos')
  AND f."field_type" IN ('BOOLEAN', 'RADIO')
  AND (f."question" ILIKE '%urgente%' OR f."question" ILIKE '%urgência%');

-- 4d. "Data prevista do evento" repete a data desejada do pedido
UPDATE "questionnaire_fields" f SET "is_active" = false, "is_required" = false
FROM "categories" c
WHERE f."category_id" = c."id" AND c."slug" = 'cerimonialista' AND f."question" ILIKE 'Data prevista%';

-- 4e. Motorista: "Diária" já é um tipo de serviço — horas só valem para "por hora"
UPDATE "questionnaire_fields" f
SET "options" = '["1-2 horas", "3-4 horas", "5-8 horas"]'::jsonb, "is_required" = false
FROM "categories" c
WHERE f."category_id" = c."id" AND c."slug" = 'motorista-particular' AND f."question" = 'Quantas horas?';

-- 4f. Perguntas "Descreva…" repetem o campo Descrição do pedido: viram a dica
--     (e a obrigatoriedade) do próprio campo Descrição.
UPDATE "categories" c
SET "description_hint" = coalesce(sub."placeholder", sub."question"),
    "description_required" = c."description_required" OR sub."is_required"
FROM (
  SELECT DISTINCT ON ("category_id") "category_id", "question", "placeholder", "is_required"
  FROM "questionnaire_fields"
  WHERE "field_type" = 'TEXTAREA' AND "question" ILIKE 'Descreva%' AND "is_active"
  ORDER BY "category_id", "order", "question"
) sub
WHERE c."id" = sub."category_id" AND c."description_hint" IS NULL;

UPDATE "questionnaire_fields" SET "is_active" = false, "is_required" = false
WHERE "field_type" = 'TEXTAREA' AND "question" ILIKE 'Descreva%';

-- 4g. Fotos são sempre opcionais
UPDATE "categories" SET "requires_photos" = false WHERE "requires_photos";

-- ---------------------------------------------------------------------------
-- 5. Idempotência da criação de pedido
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "orders_client_id_client_request_id_key" ON "orders"("client_id", "client_request_id");

-- ---------------------------------------------------------------------------
-- 6. Índices das consultas mais frequentes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "users_referred_by_id_idx" ON "users"("referred_by_id");
CREATE INDEX IF NOT EXISTS "users_deletion_requested_at_idx" ON "users"("deletion_requested_at");
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");
CREATE INDEX IF NOT EXISTS "provider_skills_category_id_is_active_idx" ON "provider_skills"("category_id", "is_active");
CREATE INDEX IF NOT EXISTS "orders_client_id_created_at_idx" ON "orders"("client_id", "created_at");
CREATE INDEX IF NOT EXISTS "orders_status_category_id_created_at_idx" ON "orders"("status", "category_id", "created_at");
CREATE INDEX IF NOT EXISTS "orders_status_provider_fee_due_at_idx" ON "orders"("status", "provider_fee_due_at");
CREATE INDEX IF NOT EXISTS "proposals_provider_id_created_at_idx" ON "proposals"("provider_id", "created_at");
CREATE INDEX IF NOT EXISTS "proposals_order_id_status_idx" ON "proposals"("order_id", "status");
CREATE INDEX IF NOT EXISTS "boost_purchases_proposal_id_idx" ON "boost_purchases"("proposal_id");
CREATE INDEX IF NOT EXISTS "schedules_client_id_scheduled_at_idx" ON "schedules"("client_id", "scheduled_at");
CREATE INDEX IF NOT EXISTS "schedules_provider_id_scheduled_at_idx" ON "schedules"("provider_id", "scheduled_at");
CREATE INDEX IF NOT EXISTS "ratings_reviewed_id_created_at_idx" ON "ratings"("reviewed_id", "created_at");
CREATE INDEX IF NOT EXISTS "ratings_reviewer_id_idx" ON "ratings"("reviewer_id");
CREATE INDEX IF NOT EXISTS "messages_schedule_id_created_at_idx" ON "messages"("schedule_id", "created_at");
CREATE INDEX IF NOT EXISTS "payments_client_id_idx" ON "payments"("client_id");
CREATE INDEX IF NOT EXISTS "payments_provider_id_idx" ON "payments"("provider_id");
CREATE INDEX IF NOT EXISTS "payments_status_hold_until_idx" ON "payments"("status", "hold_until");
CREATE INDEX IF NOT EXISTS "connection_fees_status_expires_at_idx" ON "connection_fees"("status", "expires_at");
CREATE INDEX IF NOT EXISTS "provider_withdrawals_provider_id_created_at_idx" ON "provider_withdrawals"("provider_id", "created_at");
CREATE INDEX IF NOT EXISTS "provider_withdrawals_status_idx" ON "provider_withdrawals"("status");
CREATE INDEX IF NOT EXISTS "notifications_user_id_read_created_at_idx" ON "notifications"("user_id", "read", "created_at");
CREATE INDEX IF NOT EXISTS "file_assets_owner_id_idx" ON "file_assets"("owner_id");
