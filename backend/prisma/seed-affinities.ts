import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type Affinity = {
  source: string
  target: string
  score: number
  label: string
  delay_days?: number
}

const AFFINITIES: Affinity[] = [
  { source: 'pintor', target: 'limpeza-pos-obra', score: 0.95, label: 'Após pintar, considere limpeza pós-obra', delay_days: 0 },
  { source: 'pedreiro', target: 'limpeza-pos-obra', score: 0.95, label: 'Limpeza pós-obra é essencial após reforma', delay_days: 0 },
  { source: 'pedreiro', target: 'eletricista', score: 0.7, label: 'Revisar a parte elétrica é recomendado', delay_days: 3 },
  { source: 'pedreiro', target: 'encanador', score: 0.7, label: 'Verificar encanamento após reforma', delay_days: 3 },
  { source: 'mudancas-e-carretos', target: 'diarista', score: 0.85, label: 'Faxina pós-mudança no novo endereço', delay_days: 2 },
  { source: 'mudancas-e-carretos', target: 'montador-de-moveis', score: 0.95, label: 'Montar móveis no novo endereço', delay_days: 0 },
  { source: 'corte-de-grama', target: 'jardinagem', score: 0.8, label: 'Manutenção completa do jardim', delay_days: 30 },
  { source: 'corte-de-grama', target: 'dedetizador', score: 0.4, label: 'Prevenção contra pragas no jardim', delay_days: 60 },
  { source: 'eletricista', target: 'automacao-residencial', score: 0.5, label: 'Já pensou em automatizar sua casa?', delay_days: 30 },
  { source: 'buffet-completo', target: 'djs', score: 0.7, label: 'Complete sua festa com DJ', delay_days: 0 },
  { source: 'buffet-completo', target: 'decoracao', score: 0.7, label: 'Decoração transforma seu evento', delay_days: 0 },
  { source: 'buffet-completo', target: 'garcons-e-copeiras', score: 0.85, label: 'Garçons profissionais para servir', delay_days: 0 },
  { source: 'diarista', target: 'passadeira', score: 0.6, label: 'Já pensou em uma passadeira semanal?', delay_days: 21 },
  { source: 'jardinagem', target: 'corte-de-grama', score: 0.8, label: 'Manutenção mensal do gramado', delay_days: 30 },
  { source: 'encanador', target: 'pedreiro', score: 0.4, label: 'Reforma de banheiro complementa', delay_days: 14 },
  { source: 'eletricista', target: 'cabeamento-e-redes', score: 0.6, label: 'Otimize sua rede de internet', delay_days: 14 },
  { source: 'pintor', target: 'gesso-e-drywall', score: 0.5, label: 'Forro de gesso valoriza o ambiente', delay_days: 7 },
  { source: 'marceneiro', target: 'pintor', score: 0.5, label: 'Pintura para finalizar o ambiente', delay_days: 14 },
  { source: 'montador-de-moveis', target: 'diarista', score: 0.6, label: 'Faxina após montagem', delay_days: 1 },
  { source: 'dedetizador', target: 'limpeza-pos-obra', score: 0.4, label: 'Limpeza após dedetização', delay_days: 1 },
]

async function main() {
  console.log(`[seed-affinities] Sincronizando ${AFFINITIES.length} afinidades...`)
  let upserts = 0
  for (const a of AFFINITIES) {
    await prisma.categoryAffinity.upsert({
      where: {
        source_category_target_category: {
          source_category: a.source,
          target_category: a.target,
        },
      },
      create: {
        source_category: a.source,
        target_category: a.target,
        score: a.score,
        label: a.label,
        delay_days: a.delay_days ?? 0,
      },
      update: {
        score: a.score,
        label: a.label,
        delay_days: a.delay_days ?? 0,
      },
    })
    upserts++
  }
  console.log(`[seed-affinities] ${upserts} afinidades sincronizadas.`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
