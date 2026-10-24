-- Fase 5 (escala): fila de tarefas em banco, leases dos crons e índice do feed.
-- Aditiva e reexecutável.

-- Fila de tarefas (fan-out de avisos, comunicados, push em massa).
-- Consumida com FOR UPDATE SKIP LOCKED: várias instâncias do back podem
-- processar ao mesmo tempo sem pegar a mesma tarefa.
CREATE TABLE IF NOT EXISTS "jobs" (
  "id"         TEXT PRIMARY KEY,
  "type"       TEXT NOT NULL,
  "payload"    JSONB NOT NULL DEFAULT '{}'::jsonb,
  "status"     TEXT NOT NULL DEFAULT 'PENDING',
  "attempts"   INTEGER NOT NULL DEFAULT 0,
  "run_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at"  TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "done_at"    TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "jobs_status_run_at_idx" ON "jobs"("status", "run_at");

-- Lease por cron: substitui pg_advisory_lock (que é por conexão e, com o
-- pool do Prisma, podia ficar preso para sempre).
CREATE TABLE IF NOT EXISTS "cron_leases" (
  "name"             TEXT PRIMARY KEY,
  "holder"           TEXT,
  "locked_until"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_started_at"  TIMESTAMP(3),
  "last_finished_at" TIMESTAMP(3),
  "last_error"       TEXT
);

-- Feed do prestador: filtro por categoria/status + faixa de latitude
CREATE INDEX IF NOT EXISTS "orders_category_id_status_latitude_idx" ON "orders"("category_id", "status", "latitude");
-- Fan-out: prestadores da categoria com posição
CREATE INDEX IF NOT EXISTS "users_latitude_longitude_idx" ON "users"("latitude", "longitude");
