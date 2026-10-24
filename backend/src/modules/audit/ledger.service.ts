// ============================================================
// Extrato do saldo do prestador (provider_balance).
// Toda entrada/saída passa por aqui: muda o saldo e grava a linha do
// extrato na MESMA transação — o admin consegue explicar cada centavo.
// ============================================================
import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database'
import { getRequestContext } from '../../utils/requestContext'
import { recordEvent } from './audit.service'

type Tx = Prisma.TransactionClient

export type LedgerEntry = {
  userId: string
  reason: string
  refType?: string | null
  refId?: string | null
  note?: string | null
  orderId?: string | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Crédito (valor positivo) no saldo do prestador. */
export async function creditProviderBalance(tx: Tx, entry: LedgerEntry & { amount: number }): Promise<number> {
  const amount = round2(entry.amount)
  const u = await tx.user.update({
    where: { id: entry.userId },
    data: { provider_balance: { increment: amount } },
    select: { provider_balance: true },
  })
  await writeLine(tx, entry, amount, u.provider_balance)
  return u.provider_balance
}

/**
 * Débito condicional: só desconta se houver saldo suficiente (dois débitos
 * simultâneos não deixam o saldo negativo). Devolve false se faltar saldo.
 */
export async function debitProviderBalance(tx: Tx, entry: LedgerEntry & { amount: number }): Promise<boolean> {
  const amount = round2(entry.amount)
  const moved = await tx.user.updateMany({
    where: { id: entry.userId, provider_balance: { gte: amount } },
    data: { provider_balance: { decrement: amount } },
  })
  if (moved.count === 0) return false
  const u = await tx.user.findUnique({ where: { id: entry.userId }, select: { provider_balance: true } })
  await writeLine(tx, entry, -amount, u?.provider_balance ?? 0)
  return true
}

async function writeLine(tx: Tx, entry: LedgerEntry, amount: number, balanceAfter: number) {
  const ctx = getRequestContext()
  await tx.providerBalanceTransaction.create({
    data: {
      user_id: entry.userId,
      amount,
      balance_after: round2(balanceAfter),
      reason: entry.reason,
      ref_type: entry.refType ?? null,
      ref_id: entry.refId ?? null,
      actor_id: ctx?.actorId ?? null,
      note: entry.note ?? null,
    },
  })
  await recordEvent(
    {
      type: amount >= 0 ? 'BALANCE_CREDIT' : 'BALANCE_DEBIT',
      userId: entry.userId,
      orderId: entry.orderId ?? null,
      entityType: entry.refType ?? null,
      entityId: entry.refId ?? null,
      amount,
      reason: entry.note ?? entry.reason,
      metadata: { reason: entry.reason, balance_after: round2(balanceAfter) },
    },
    tx,
  )
}

/** Conferência: soma do extrato x saldo atual (para o painel e o cron). */
export async function reconcileBalances(limit = 500) {
  const rows = await prisma.$queryRaw<Array<{ user_id: string; ledger: number; balance: number }>>`
    SELECT u.id AS user_id, COALESCE(SUM(t.amount), 0)::float AS ledger, u.provider_balance::float AS balance
    FROM users u
    LEFT JOIN provider_balance_transactions t ON t.user_id = u.id
    WHERE u.provider_balance <> 0 OR t.id IS NOT NULL
    GROUP BY u.id, u.provider_balance
    HAVING ABS(COALESCE(SUM(t.amount), 0) - u.provider_balance) > 0.009
    LIMIT ${limit}`
  return rows
}
