export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(date))
}

export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date))
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Aberto',
  IN_PROPOSAL: 'Em proposta',
  ACCEPTED: 'Aguardando pagamento',
  SCHEDULED: 'Agendado',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluído',
  RATED: 'Avaliado',
  CANCELLED: 'Cancelado',
  DISPUTED: 'Em disputa',
}

export const ORDER_STATUS_COLOR: Record<string, string> = {
  OPEN: '#3b82f6',
  IN_PROPOSAL: '#f59e0b',
  ACCEPTED: '#f97316',
  SCHEDULED: '#8b5cf6',
  IN_PROGRESS: '#06b6d4',
  DONE: '#10b981',
  RATED: '#6b7280',
  CANCELLED: '#ef4444',
  DISPUTED: '#dc2626',
}

export const SCHEDULE_STATUS_LABEL: Record<string, string> = {
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluído',
  CANCELLED: 'Cancelado',
}
