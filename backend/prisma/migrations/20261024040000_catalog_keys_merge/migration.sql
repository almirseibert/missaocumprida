-- Catálogo: chave estável por pergunta (o seed passa a ATUALIZAR em vez de
-- apagar/recriar), suporte a mescla de categorias duplicadas e ordem de
-- exibição. Reexecutável.

ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "merged_into_id" TEXT;

-- Chave determinística = 'q_' + md5(pergunta)[0..10] — mesma fórmula do seed
-- (prisma/catalogSync.ts → fieldKey)
UPDATE "questionnaire_fields" SET "key" = 'q_' || substr(md5("question"), 1, 10) WHERE "key" IS NULL;

-- Pergunta repetida na mesma categoria: a mais nova ganha sufixo
UPDATE "questionnaire_fields" f SET "key" = f."key" || '_' || substr(f."id", 1, 8)
WHERE EXISTS (
  SELECT 1 FROM "questionnaire_fields" g
  WHERE g."category_id" = f."category_id" AND g."key" = f."key"
    AND (g."created_at" < f."created_at" OR (g."created_at" = f."created_at" AND g."id" < f."id"))
);

CREATE UNIQUE INDEX IF NOT EXISTS "questionnaire_fields_category_id_key_key" ON "questionnaire_fields"("category_id", "key");

-- Ordem de exibição: todas as categorias estavam com ordem 0 (lista aleatória).
-- Alfabética dentro do grupo; inativas no fim.
UPDATE "categories" c SET "order" = sub.rn
FROM (
  SELECT "id",
    CASE WHEN "is_active" THEN row_number() OVER (PARTITION BY "group_id", "is_active" ORDER BY lower("name")) ELSE 999 END AS rn
  FROM "categories"
) sub
WHERE c."id" = sub."id" AND c."order" = 0;
