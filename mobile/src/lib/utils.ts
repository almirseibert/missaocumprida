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

export function formatRelative(date: string | Date): string {
  const d = new Date(date).getTime()
  const diff = Math.max(0, Date.now() - d)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'agora há pouco'
  const min = Math.floor(sec / 60)
  if (min < 60) return `há ${min} min`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `há ${days} d`
  return formatDateShort(date)
}

/**
 * Máscara progressiva de data brasileira: digita-se só números e o campo
 * vira DD/MM/AAAA. Use junto com keyboardType="number-pad".
 */
export function maskDateBR(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

/**
 * Valida DD/MM/AAAA como data real do calendário e devolve 'AAAA-MM-DD',
 * ou null se inválida/incompleta.
 */
export function parseDateBR(value: string): string | null {
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const [, dd, mm, yyyy] = m
  const day = Number(dd)
  const month = Number(mm)
  const year = Number(yyyy)
  if (year < 1900 || year > 2100 || month < 1 || month > 12) return null
  const daysInMonth = [31, (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (day < 1 || day > daysInMonth[month - 1]) return null
  return `${yyyy}-${mm}-${dd}`
}

/** Converte 'AAAA-MM-DD' (ou ISO) para DD/MM/AAAA para exibição/edição. */
export function isoToDateBR(value: string | null | undefined): string {
  if (!value) return ''
  const m = value.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
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
