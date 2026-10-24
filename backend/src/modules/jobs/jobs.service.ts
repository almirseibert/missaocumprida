// ============================================================
// Fila de tarefas em banco (tabela jobs).
// Trabalho pesado que não precisa acontecer dentro da requisição — avisar
// os prestadores de um pedido novo, comunicados para toda a base — vira uma
// tarefa. Cada instância do backend consome a fila com FOR UPDATE SKIP
// LOCKED (duas instâncias nunca pegam a mesma tarefa). Falha → nova
// tentativa com espera crescente, até 5 vezes.
// ============================================================
import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database'
import { sendToUsers, emitNotificationSignal } from '../push/push.service'
import { runWithContext } from '../../utils/requestContext'

export type JobType = 'NEW_ORDER_FANOUT' | 'BROADCAST' | 'ANNOUNCEMENT_PUSH'

const MAX_ATTEMPTS = 5
const BATCH = 10
const POLL_MS = 2000
const NOTIFY_CHUNK = 1000

type JobRow = { id: string; type: JobType; payload: Record<string, unknown>; attempts: number }
type Handler = (payload: Record<string, unknown>) => Promise<void>

const handlers: Partial<Record<JobType, Handler>> = {}

/** Registra o que fazer com cada tipo de tarefa (chamado pelos módulos). */
export function registerJobHandler(type: JobType, handler: Handler): void {
  handlers[type] = handler
}

/** Põe uma tarefa na fila. Pode receber a transação para nascer junto com o dado. */
export async function enqueueJob(
  type: JobType,
  payload: Record<string, unknown>,
  opts: { runAt?: Date; tx?: Prisma.TransactionClient } = {},
): Promise<void> {
  const db = opts.tx ?? prisma
  await db.job.create({ data: { type, payload: payload as Prisma.InputJsonValue, run_at: opts.runAt ?? new Date() } })
}

async function claim(): Promise<JobRow[]> {
  return prisma.$queryRaw<JobRow[]>`
    UPDATE jobs SET status = 'RUNNING', locked_at = (now() AT TIME ZONE 'utc'), attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM jobs
      WHERE status = 'PENDING' AND run_at <= (now() AT TIME ZONE 'utc')
      ORDER BY run_at
      LIMIT ${BATCH}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, type, payload, attempts`
}

async function runOne(job: JobRow): Promise<void> {
  const handler = handlers[job.type]
  try {
    if (!handler) throw new Error(`sem handler para ${job.type}`)
    await runWithContext({ actorRole: 'SYSTEM' }, () => handler(job.payload ?? {}))
    await prisma.job.update({ where: { id: job.id }, data: { status: 'DONE', done_at: new Date(), last_error: null } })
  } catch (err) {
    const msg = String((err as Error)?.message ?? err).slice(0, 500)
    const giveUp = job.attempts >= MAX_ATTEMPTS
    console.error(`[jobs] ${job.type} ${job.id} falhou (tentativa ${job.attempts}):`, msg)
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: giveUp ? 'FAILED' : 'PENDING',
        last_error: msg,
        // 30 s, 2 min, 8 min, 32 min…
        run_at: new Date(Date.now() + 30_000 * 4 ** (job.attempts - 1)),
      },
    }).catch(() => {})
  }
}

let running = false
let timer: NodeJS.Timeout | null = null

async function tick(): Promise<void> {
  if (running) return
  running = true
  try {
    for (let round = 0; round < 20; round++) {
      const jobs = await claim()
      if (jobs.length === 0) break
      for (const job of jobs) await runOne(job)
    }
  } catch (err) {
    console.error('[jobs] erro no ciclo:', (err as Error)?.message ?? err)
  } finally {
    running = false
  }
}

/** Inicia o consumidor desta instância. */
export function startJobWorker(): void {
  if (timer) return
  timer = setInterval(() => void tick(), POLL_MS)
  timer.unref?.()
}

/** Para testes e para o desligamento do servidor. */
export async function drainJobs(): Promise<void> {
  await tick()
}

/** Manutenção (cron): devolve tarefas presas e apaga as concluídas antigas. */
export async function maintainJobs(): Promise<{ requeued: number; purged: number }> {
  const requeued = await prisma.$executeRaw`
    UPDATE jobs SET status = 'PENDING', run_at = (now() AT TIME ZONE 'utc')
    WHERE status = 'RUNNING' AND locked_at < (now() AT TIME ZONE 'utc') - interval '15 minutes'`
  const purged = await prisma.$executeRaw`
    DELETE FROM jobs WHERE status = 'DONE' AND done_at < (now() AT TIME ZONE 'utc') - interval '7 days'`
  return { requeued, purged }
}

// ---------------------------------------------------------------------------
// Utilitário dos handlers: notificação in-app + push em blocos
// ---------------------------------------------------------------------------
export async function notifyMany(
  userIds: string[],
  n: { type: string; title: string; body: string; data?: Record<string, unknown>; channel?: Parameters<typeof sendToUsers>[1]['channel'] },
): Promise<void> {
  for (let i = 0; i < userIds.length; i += NOTIFY_CHUNK) {
    const slice = userIds.slice(i, i + NOTIFY_CHUNK)
    await prisma.notification.createMany({
      data: slice.map((id) => ({
        user_id: id,
        type: n.type as never,
        title: n.title,
        body: n.body,
        data: (n.data ?? undefined) as never,
      })),
    })
    emitNotificationSignal(slice, n.type)
    await sendToUsers(slice, { title: n.title, body: n.body, data: { ...(n.data ?? {}), type: n.type }, channel: n.channel ?? 'general' })
  }
}
