-- Revisão pós-Play (fase 3): local exato do serviço, edição/exclusão de
-- pedido pelo cliente e cache de geocodificação. Aditiva e reexecutável.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "location_updated_at" TIMESTAMP(3);

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cep" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "address_number" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "address_complement" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "location_source" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "location_accuracy_m" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "location_captured_at" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "answers_snapshot" JSONB;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "edited_at" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "edit_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancelled_by" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cancel_reason" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "hidden_by_client_at" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "original_category_id" TEXT;

CREATE TABLE IF NOT EXISTS "geo_cache" (
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "geo_cache_pkey" PRIMARY KEY ("key")
);

-- Pedidos antigos com coordenadas: origem desconhecida (podia ser o perfil)
UPDATE "orders" SET "location_source" = 'LEGACY'
WHERE "latitude" IS NOT NULL AND "location_source" IS NULL;

-- Foto das perguntas/respostas no momento do pedido: continua legível mesmo
-- se a pergunta for editada, arquivada ou a categoria for mesclada.
UPDATE "orders" o SET "answers_snapshot" = sub.snap
FROM (
  SELECT o2."id",
         jsonb_agg(jsonb_build_object(
           'field_id', f."id", 'question', f."question",
           'field_type', f."field_type", 'value', o2."answers"::jsonb ->> f."id"
         ) ORDER BY f."order", f."question") AS snap
  FROM "orders" o2
  JOIN "questionnaire_fields" f ON f."category_id" = o2."category_id"
  WHERE f."field_type" <> 'PHOTO' AND (o2."answers"::jsonb ? f."id")
  GROUP BY o2."id"
) sub
WHERE o."id" = sub."id" AND o."answers_snapshot" IS NULL;
