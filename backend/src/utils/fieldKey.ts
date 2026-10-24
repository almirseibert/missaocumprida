import crypto from 'crypto'

/**
 * Chave estável de uma pergunta do questionário: 'q_' + md5(pergunta)[0..10].
 * Mesma fórmula usada pelo seed (prisma/catalogSync.ts) e pela migração
 * 20261024040000 — o seed atualiza a pergunta existente em vez de recriar.
 */
export function fieldKey(question: string): string {
  return 'q_' + crypto.createHash('md5').update(question, 'utf8').digest('hex').slice(0, 10)
}
