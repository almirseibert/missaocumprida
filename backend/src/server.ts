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
import { withCronLock } from './utils/cronLock'

async function start() {
  try {
    await prisma.$connect()
    console.log('✅ Banco de dados conectado')

    const httpServer = createServer(app)
    initRealtime(httpServer)

    // Cron diário às 02h: gera ocorrências de assinaturas dos próximos 7 dias
    cron.schedule('0 2 * * *', async () => {
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

    // Cron diário às 03h: Segurança de Transação — libera pagamentos já
    // aprovados pelo admin cuja janela de garantia (7 dias) terminou.
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

process.on('SIGINT', async () => {
  await prisma.$disconnect()
  console.log('\n👋 Servidor encerrado.')
  process.exit(0)
})

start()
