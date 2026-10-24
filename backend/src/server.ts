import { createServer } from 'http'
import cron from 'node-cron'
import app from './app'
import { env } from './config/env'
import { prisma } from './config/database'
import { initRealtime } from './modules/realtime/realtime'
import { generateUpcomingOccurrences } from './modules/subscriptions/subscriptions.service'
import { runCrossSellPushSweep } from './modules/recommendations/crossSellPush.service'
import { runUrgencySla } from './modules/urgency/urgency.service'
import { releaseEligiblePayments } from './modules/payments/payments.service'
import { expireOverdueProviderFees } from './modules/payments/connectionFees.service'
import { purgeExpiredDeletionRequests } from './modules/users/deletion.service'
import { withCronLock } from './utils/cronLock'

async function start() {
  try {
    await prisma.$connect()
    console.log('✅ Banco de dados conectado')

    const httpServer = createServer(app)
    initRealtime(httpServer)

    // Cron diário às 02h: gera ocorrências de assinaturas dos próximos 7 dias.
    // Desligado (RECURRING_ENABLED) até as ocorrências cobrarem a Taxa de Conexão.
    if (env.RECURRING_ENABLED) cron.schedule('0 2 * * *', async () => {
      try {
        await withCronLock('subscriptions-occurrences', async () => {
          const result = await generateUpcomingOccurrences(7)
          console.log(`[cron][subscriptions] geradas ${result.generated}/${result.total} ocorrências`)
        })
      } catch (err) {
        console.error('[cron][subscriptions] erro:', err)
      }
    })

    // Cron a cada 5min: SLA do modo urgência (expande raio, cancela após deadline)
    cron.schedule('*/5 * * * *', async () => {
      try {
        await withCronLock('urgency-sla', async () => {
          const result = await runUrgencySla()
          if (result.expanded > 0 || result.cancelled > 0) {
            console.log(`[cron][urgency] verificados=${result.checked} expandidos=${result.expanded} cancelados=${result.cancelled}`)
          }
        })
      } catch (err) {
        console.error('[cron][urgency] erro:', err)
      }
    })

    // Cron a cada 15min: Taxa de Conexão — expira taxa de prestador vencida,
    // recredita o cliente e devolve o pedido para a fila.
    cron.schedule('*/15 * * * *', async () => {
      try {
        await withCronLock('connection-fee-timeout', async () => {
          const result = await expireOverdueProviderFees()
          if (result.expired > 0) {
            console.log(`[cron][taxa-conexao] expiradas ${result.expired} taxa(s) de prestador`)
          }
        })
      } catch (err) {
        console.error('[cron][taxa-conexao] erro:', err)
      }
    })

    // Cron diário às 03h: (LEGADO) Segurança de Transação — libera pagamentos
    // antigos em HELD já aprovados pelo admin. Remover quando zerar o escrow.
    cron.schedule('0 3 * * *', async () => {
      try {
        await withCronLock('release-held-payments', async () => {
          const result = await releaseEligiblePayments()
          if (result.released > 0) {
            console.log(`[cron][seguranca-transacao] liberados ${result.released} pagamento(s)`)
          }
        })
      } catch (err) {
        console.error('[cron][seguranca-transacao] erro:', err)
      }
    })

    // Cron diário às 04h: purga contas com exclusão agendada e prazo de
    // arrependimento vencido (página /cancelar-assinatura).
    cron.schedule('0 4 * * *', async () => {
      try {
        await withCronLock('purge-deletion-requests', async () => {
          const result = await purgeExpiredDeletionRequests()
          if (result.purged > 0 || result.blocked > 0) {
            console.log(`[cron][exclusao] purgadas=${result.purged} bloqueadas=${result.blocked}`)
          }
        })
      } catch (err) {
        console.error('[cron][exclusao] erro:', err)
      }
    })

    // Cron diário às 10h: dispara push de cross-sell respeitando delay_days das afinidades
    cron.schedule('0 10 * * *', async () => {
      try {
        await withCronLock('cross-sell-push', async () => {
          const result = await runCrossSellPushSweep()
          console.log(`[cron][cross-sell] varridos=${result.scanned} enviados=${result.sent}`)
        })
      } catch (err) {
        console.error('[cron][cross-sell] erro:', err)
      }
    })

    httpServer.listen(env.PORT, () => {
      console.log('')
      console.log('🚀 Missão Cumprida API rodando!')
      console.log(`   URL:      http://localhost:${env.PORT}`)
      console.log(`   Health:   http://localhost:${env.PORT}/health`)
      console.log(`   Socket:   ws://localhost:${env.PORT}`)
      console.log(`   Ambiente: ${env.NODE_ENV}`)
      console.log('')
    })
  } catch (err) {
    console.error('❌ Erro ao iniciar o servidor:', err)
    process.exit(1)
  }
}

// Rede de segurança: registra em vez de derrubar a API por um erro isolado
// (ex.: cron, push assíncrono sem catch).
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
})

process.on('SIGTERM', async () => {
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGINT', async () => {
  await prisma.$disconnect()
  console.log('\n👋 Servidor encerrado.')
  process.exit(0)
})

start()
