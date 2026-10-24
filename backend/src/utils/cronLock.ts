import os from 'os'
import crypto from 'crypto'
import { prisma } from '../config/database'

// Identifica esta instância do backend (aparece em cron_leases.holder)
const HOLDER = `${os.hostname()}:${process.pid}:${crypto.randomBytes(3).toString('hex')}`

/**
 * Garante que só uma instância execute o cron por vez.
 * Usa um "lease" com prazo na tabela cron_leases: se a instância morrer no
 * meio, o lease vence sozinho e o próximo ciclo roda normalmente.
 * (Antes era pg_advisory_lock, que é por conexão: com o pool do Prisma o
 * unlock podia cair em outra conexão e a trava ficava presa para sempre.)
 * Retorna null se outra instância já está com o lease.
 */
export async function withCronLock<T>(
  name: string,
  fn: () => Promise<T>,
  ttlMinutes = 30,
): Promise<T | null> {
  const ttl = Math.max(1, Math.round(ttlMinutes))
  const got = await prisma.$queryRaw<Array<{ name: string }>>`
    INSERT INTO cron_leases (name, holder, locked_until, last_started_at)
    VALUES (${name}, ${HOLDER}, (now() AT TIME ZONE 'utc') + make_interval(mins => ${ttl}::int), (now() AT TIME ZONE 'utc'))
    ON CONFLICT (name) DO UPDATE
      SET holder = EXCLUDED.holder, locked_until = EXCLUDED.locked_until, last_started_at = (now() AT TIME ZONE 'utc')
      WHERE cron_leases.locked_until < (now() AT TIME ZONE 'utc')
    RETURNING name`
  if (got.length === 0) {
    console.log(`[cron-lock] ${name} já em execução em outra instância — pulando`)
    return null
  }
  let error: string | null = null
  try {
    return await fn()
  } catch (err) {
    error = String((err as Error)?.message ?? err).slice(0, 500)
    throw err
  } finally {
    await prisma.$executeRaw`
      UPDATE cron_leases SET locked_until = (now() AT TIME ZONE 'utc'), last_finished_at = (now() AT TIME ZONE 'utc'), last_error = ${error}
      WHERE name = ${name} AND holder = ${HOLDER}`.catch((err) => console.error('[cron-lock] erro ao liberar lease:', err))
  }
}
