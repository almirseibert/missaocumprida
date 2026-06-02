export function formatCurrency(value: number): string {
  const fixed = Math.abs(value).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${value < 0 ? '-' : ''}R$ ${fixed}`
}

function pad(n: number) { return String(n).padStart(2, '0') }

export function formatDate(date: string | Date): string {
  const d = new Date(date)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDateShort(date: string | Date): string {
  const d = new Date(date)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function formatTime(date: string | Date): string {
  const d = new Date(date)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
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
