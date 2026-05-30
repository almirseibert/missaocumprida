import app from './app'
import { env } from './config/env'
import { prisma } from './config/database'

async function start() {
  try {
    await prisma.$connect()
    console.log('✅ Banco de dados conectado')

    app.listen(env.PORT, () => {
      console.log('')
      console.log('🚀 Missão Cumprida API rodando!')
      console.log(`   URL:      http://localhost:${env.PORT}`)
      console.log(`   Health:   http://localhost:${env.PORT}/health`)
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
