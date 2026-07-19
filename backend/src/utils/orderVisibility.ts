/**
 * Visibilidade de contato (Remap 2.0 — Taxa de Conexão).
 * Telefone, endereço exato e chat só são liberados quando as DUAS taxas de
 * conexão foram pagas — momento em que o pedido vira SCHEDULED. Antes disso
 * (OPEN/IN_PROPOSAL/ACCEPTED) as respostas da API mascaram esses dados.
 */
export const CONTACT_UNLOCKED_ORDER_STATUSES = [
  'SCHEDULED',
  'IN_PROGRESS',
  'DONE',
  'RATED',
  'CANCELLED',
  'DISPUTED',
]

export function contactsUnlocked(orderStatus: string | undefined | null): boolean {
  return !!orderStatus && CONTACT_UNLOCKED_ORDER_STATUSES.includes(orderStatus)
}
