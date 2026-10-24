-- Um cadastro por CPF. Reexecutável.
-- 1) CPF passa a ser guardado só com dígitos;
-- 2) se duas contas tinham o mesmo CPF, ele fica só na mais confiável
--    (documentos aprovados > em análise > ativa > mais antiga) e as outras
--    vão para cpf_conflicts para o suporte regularizar;
-- 3) CPF único em users + registro permanente (cpf_registry), preenchido pelo
--    backend no boot (o hash usa uma chave que não pode ir para o SQL).

UPDATE "users" SET "cpf" = NULLIF(regexp_replace("cpf", '\D', '', 'g'), '')
WHERE "cpf" IS NOT NULL AND "cpf" IS DISTINCT FROM NULLIF(regexp_replace("cpf", '\D', '', 'g'), '');

CREATE TABLE IF NOT EXISTS "cpf_conflicts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kept_user_id" TEXT NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cpf_conflicts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "cpf_conflicts_user_id_idx" ON "cpf_conflicts"("user_id");

WITH ranked AS (
  SELECT "id", "cpf",
    row_number() OVER w AS rn,
    first_value("id") OVER w AS kept
  FROM "users"
  WHERE "cpf" IS NOT NULL
  WINDOW w AS (
    PARTITION BY "cpf"
    ORDER BY ("document_verification_status" = 'APPROVED') DESC,
             ("document_verification_status" = 'PENDING') DESC,
             "is_active" DESC,
             "created_at" ASC
  )
)
INSERT INTO "cpf_conflicts" ("id", "user_id", "kept_user_id")
SELECT md5('cpfconf:' || r."id"), r."id", r."kept" FROM ranked r WHERE r.rn > 1
ON CONFLICT ("id") DO NOTHING;

UPDATE "users" SET "cpf" = NULL
WHERE "id" IN (SELECT "user_id" FROM "cpf_conflicts" WHERE "resolved_at" IS NULL) AND "cpf" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "users" k WHERE k."id" = (SELECT c."kept_user_id" FROM "cpf_conflicts" c WHERE c."user_id" = "users"."id" LIMIT 1) AND k."cpf" = "users"."cpf");

CREATE UNIQUE INDEX IF NOT EXISTS "users_cpf_key" ON "users"("cpf");

CREATE TABLE IF NOT EXISTS "cpf_registry" (
    "cpf_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "released_by" TEXT,
    "release_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cpf_registry_pkey" PRIMARY KEY ("cpf_hash")
);
CREATE INDEX IF NOT EXISTS "cpf_registry_user_id_idx" ON "cpf_registry"("user_id");
