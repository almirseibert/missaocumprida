import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { OrderStatus, ProposalStatus, ScheduleStatus } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR })
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function getAvatarUrl(avatar?: string): string | undefined {
  if (!avatar) return undefined
  if (avatar.startsWith('http')) return avatar
  return `${process.env.NEXT_PUBLIC_API_URL}/${avatar}`
}

/**
 * Anexa o token de acesso à URL de um arquivo sensível (documento/selfie KYC),
 * que o backend agora exige para download. Como <img> não envia cabeçalhos,
 * o backend também aceita o token via ?token=. Use só para imagens KYC.
 */
export function authFileUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  if (typeof window === 'undefined') return url
  const token = localStorage.getItem('accessToken')
  if (!token) return url
  return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
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

// Cores semânticas alinhadas ao guia (seção 06 — Badges e Status).
// Para um componente <Badge>, prefira `ORDER_STATUS_BADGE` em ui/Badge.tsx.
export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  OPEN:        'bg-slate2-100 text-slate2-600',
  IN_PROPOSAL: 'bg-brand-100 text-brand-700',
  ACCEPTED:    'bg-violet-100 text-violet-700',
  SCHEDULED:   'bg-amber-100 text-amber-800',
  IN_PROGRESS: 'bg-fuchsia-50 text-fuchsia-700',
  DONE:        'bg-accent-100 text-accent-700',
  RATED:       'bg-accent-100 text-accent-700',
  CANCELLED:   'bg-red-50 text-red-600',
  DISPUTED:    'bg-red-50 text-red-600',
}

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  PENDING: 'Aguardando',
  ACCEPTED: 'Aceita',
  REJECTED: 'Recusada',
  CANCELLED: 'Cancelada',
}

export const SCHEDULE_STATUS_LABEL: Record<ScheduleStatus, string> = {
  CONFIRMED: 'Confirmado',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluído',
  CANCELLED: 'Cancelado',
}

export const SCHEDULE_STATUS_COLOR: Record<ScheduleStatus, string> = {
  CONFIRMED:   'bg-violet-100 text-violet-700',
  IN_PROGRESS: 'bg-fuchsia-50 text-fuchsia-700',
  DONE:        'bg-accent-100 text-accent-700',
  CANCELLED:   'bg-red-50 text-red-600',
}
