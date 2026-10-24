import crypto from 'crypto'
import { env } from '../config/env'

/** Só os dígitos do CPF ("123.456.789-09" → "12345678909"). */
export function normalizeCpf(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '')
}

/** Valida os dois dígitos verificadores (módulo 11) e rejeita sequências repetidas. */
export function isValidCpf(value: unknown): boolean {
  const cpf = normalizeCpf(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const digits = cpf.split('').map(Number)
  const check = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += digits[i] * (len + 1 - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return check(9) === digits[9] && check(10) === digits[10]
}

/** "123.***.***-09" — para logs, telas do admin e mensagens. */
export function maskCpf(value: unknown): string {
  const cpf = normalizeCpf(value)
  if (cpf.length !== 11) return '***'
  return `${cpf.slice(0, 3)}.***.***-${cpf.slice(9)}`
}

// Chave do hash: CPF_HASH_KEY (recomendado) ou, na falta dela, uma derivada
// do JWT_SECRET. Hashes antigos continuam valendo se a chave dedicada for
// definida depois — cpfHashes() devolve os dois.
function keys(): string[] {
  const derived = crypto.createHash('sha256').update(`cpf-registry:${env.JWT_SECRET}`).digest('hex')
  return env.CPF_HASH_KEY && env.CPF_HASH_KEY !== derived ? [env.CPF_HASH_KEY, derived] : [derived]
}

/**
 * Hash irreversível do CPF (HMAC-SHA256). É o que fica guardado depois que a
 * conta é excluída ou banida — permite barrar um novo cadastro com o mesmo
 * CPF sem manter o número em si.
 */
export function cpfHash(value: unknown): string {
  return crypto.createHmac('sha256', keys()[0]).update(normalizeCpf(value)).digest('hex')
}

/** Todos os hashes possíveis do CPF (chave atual + anteriores). */
export function cpfHashes(value: unknown): string[] {
  const cpf = normalizeCpf(value)
  return keys().map((k) => crypto.createHmac('sha256', k).update(cpf).digest('hex'))
}
