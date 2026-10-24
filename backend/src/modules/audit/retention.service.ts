// ============================================================
// Retenção dos registros de rastreabilidade (Política de Privacidade):
// - acessos (login/refresh/logout): 12 meses (Marco Civil exige 6)
// - eventos que envolvem dinheiro, contato liberado, moderação e documentos:
//   5 anos (CDC / defesa em reclamações e chargebacks)
// - demais eventos: 2 anos
// - webhooks recebidos: 5 anos
// Apaga em lotes pequenos para não travar as tabelas.
// ============================================================
import { prisma } from '../../config/database'
import { reconcileBalances } from './ledger.service'

const BATCH = 5000
const LONG_KEEP = '^(FEE|BALANCE|WITHDRAWAL|PAYMENT|CREDIT|PRO|CONTACT|USER_BANNED|USER_SUSPENDED|CPF|KYC|NO_SHOW|SCHEDULE_CANCELLED|ACCOUNT_DELETED|ORDER_CANCELLED|SERVICE|ADMIN|PIX|WEBHOOK)'

async function deleteInBatches(run: () => Promise<number>): Promise<number> {
  let total = 0
  for (let i = 0; i < 200; i++) {
    const n = await run()
    total += n
    if (n < BATCH) break
  }
  return total
}

export async function purgeExpiredAuditData(): Promise<{ access: number; events: number; webhooks: number }> {
  const access = await deleteInBatches(() => prisma.$executeRaw`
    DELETE FROM access_logs WHERE id IN (
      SELECT id FROM access_logs WHERE created_at < now() - interval '12 months' LIMIT ${BATCH})`)
  const short = await deleteInBatches(() => prisma.$executeRaw`
    DELETE FROM audit_events WHERE id IN (
      SELECT id FROM audit_events
      WHERE created_at < now() - interval '2 years' AND amount IS NULL AND type !~ ${LONG_KEEP}
      LIMIT ${BATCH})`)
  const long = await deleteInBatches(() => prisma.$executeRaw`
    DELETE FROM audit_events WHERE id IN (
      SELECT id FROM audit_events WHERE created_at < now() - interval '5 years' LIMIT ${BATCH})`)
  const webhooks = await deleteInBatches(() => prisma.$executeRaw`
    DELETE FROM webhook_events WHERE id IN (
      SELECT id FROM webhook_events WHERE received_at < now() - interval '5 years' LIMIT ${BATCH})`)
  return { access, events: short + long, webhooks }
}

/** Conferência diária: saldo do prestador x soma do extrato. */
export async function dailyReconciliation(): Promise<number> {
  const mismatch = await reconcileBalances(50)
  if (mismatch.length > 0) {
    console.warn(
      `[conciliacao] ${mismatch.length} saldo(s) diferente(s) do extrato — ver /admin/auditoria (Conciliação):`,
      mismatch.slice(0, 10).map((m) => `${m.user_id}: saldo ${m.balance} x extrato ${m.ledger}`).join('; '),
    )
  }
  return mismatch.length
}
