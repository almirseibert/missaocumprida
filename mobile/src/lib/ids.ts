/**
 * Identificador aleatório no formato UUID v4 (Hermes não tem crypto.randomUUID).
 * Usado como client_request_id: se a rede cair e o pedido for reenviado, o
 * servidor devolve o mesmo pedido em vez de criar outro. Não é segredo.
 */
export function randomUuid(): string {
  const hex = '0123456789abcdef'
  let out = ''
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-'
    else if (i === 14) out += '4'
    else if (i === 19) out += hex[8 + ((Math.random() * 4) | 0)]
    else out += hex[(Math.random() * 16) | 0]
  }
  return out
}

/** CPF válido: 11 dígitos, dígitos verificadores corretos, não repetido. */
export function isValidCpf(value: string | null | undefined): boolean {
  const cpf = String(value ?? '').replace(/\D/g, '')
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const d = cpf.split('').map(Number)
  const check = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += d[i] * (len + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return check(9) === d[9] && check(10) === d[10]
}

export function maskCpf(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function maskCep(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}
