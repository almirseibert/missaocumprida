import { prisma } from '../config/database'

function hashKey(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0
  }
  return h
}

/**
 * Postgres advisory lock para garantir que apenas uma instância execute o job.
 * Retorna null se outra instância já está rodando o mesmo cron.
 */
export async function withCronLock<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
  const key = hashKey(name)
  const rows = await prisma.$queryRaw<Array<{ ok: boolean }>>`SELECT pg_try_advisory_lock(${key}::int) as ok`
  if (!rows[0]?.ok) {
    console.log(`[cron-lock] ${name} já em execução em outra instância — pulando`)
    return null
  }
  try {
    return await fn()
  } finally {
    try {
      await prisma.$queryRaw`SELECT pg_advisory_unlock(${key}::int)`
    } catch (err) {
      console.error('[cron-lock] erro ao liberar lock:', err)
    }
  }
}
