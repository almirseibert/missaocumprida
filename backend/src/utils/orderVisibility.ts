/**
 * Visibilidade de contato (Remap 2.0 — Taxa de Conexão).
 * Telefone, endereço exato e chat só são liberados quando as DUAS taxas de
 * conexão foram pagas — momento em que o pedido vira SCHEDULED. Antes disso
 * (OPEN/IN_PROPOSAL/ACCEPTED) as respostas da API mascaram esses dados.
 *
 * CANCELLED só conta como liberado se a taxa do prestador chegou a ser paga:
 * um pedido cancelado ainda na janela ACCEPTED (ex.: pelo admin) não pode
 * expor o contato de graça.
 */
export const CONTACT_UNLOCKED_ORDER_STATUSES = [
  'SCHEDULED',
  'IN_PROGRESS',
  'DONE',
  'RATED',
  'DISPUTED',
]

export function contactsUnlocked(
  orderStatus: string | undefined | null,
  providerFeePaidAt?: Date | null,
): boolean {
  if (!orderStatus) return false
  if (orderStatus === 'CANCELLED') return !!providerFeePaidAt
  return CONTACT_UNLOCKED_ORDER_STATUSES.includes(orderStatus)
}

/** Filtro Prisma equivalente a contactsUnlocked() para a relação `order`. */
export function unlockedOrderWhere() {
  return {
    OR: [
      { status: { in: CONTACT_UNLOCKED_ORDER_STATUSES } },
      { status: 'CANCELLED', provider_fee_paid_at: { not: null } },
    ],
  } as const
}
