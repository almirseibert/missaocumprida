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

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  OPEN: 'Aberto',
  IN_PROPOSAL: 'Em proposta',
  ACCEPTED: 'Aceito',
  SCHEDULED: 'Agendado',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluído',
  RATED: 'Avaliado',
  CANCELLED: 'Cancelado',
  DISPUTED: 'Em disputa',
}

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROPOSAL: 'bg-yellow-100 text-yellow-700',
  ACCEPTED: 'bg-purple-100 text-purple-700',
  SCHEDULED: 'bg-indigo-100 text-indigo-700',
  IN_PROGRESS: 'bg-orange-100 text-orange-700',
  DONE: 'bg-green-100 text-green-700',
  RATED: 'bg-green-200 text-green-800',
  CANCELLED: 'bg-red-100 text-red-700',
  DISPUTED: 'bg-red-200 text-red-800',
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
  CONFIRMED: 'bg-indigo-100 text-indigo-700',
  IN_PROGRESS: 'bg-orange-100 text-orange-700',
  DONE: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}
