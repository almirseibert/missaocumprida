import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export type BadgeVariant =
  | 'blue'    // padrão / em propostas
  | 'green'   // sucesso / concluído / avaliado
  | 'amber'   // atenção / agendado
  | 'red'     // erro / cancelado / disputa
  | 'gray'    // neutro / aberto
  | 'purple'  // aceito
  | 'fuchsia' // em andamento

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: 'sm' | 'md'
  withDot?: boolean
}

const variants: Record<BadgeVariant, string> = {
  blue:    'bg-brand-100 text-brand-700',
  green:   'bg-accent-100 text-accent-700',
  amber:   'bg-amber-100 text-amber-800',
  red:     'bg-red-50 text-red-600',
  gray:    'bg-slate2-100 text-slate2-600',
  purple:  'bg-violet-100 text-violet-700',
  fuchsia: 'bg-fuchsia-50 text-fuchsia-700',
}

const sizes = {
  sm: 'px-2.5 py-0.5 text-xs gap-1.5',
  md: 'px-3 py-1 text-sm gap-2',
}

export function Badge({
  className,
  variant = 'blue',
  size = 'sm',
  withDot = true,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {withDot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      )}
      {children}
    </span>
  )
}

/**
 * Mapeamento status do pedido/agendamento → variante + label.
 * Cobre todos os 9 estados definidos no guia (seção 06 — Badges e Status).
 */
export const ORDER_STATUS_BADGE: Record<string, { variant: BadgeVariant; label: string }> = {
  OPEN:        { variant: 'gray',    label: 'Aberto' },
  IN_PROPOSAL: { variant: 'blue',    label: 'Em propostas' },
  ACCEPTED:    { variant: 'purple',  label: 'Aceito' },
  SCHEDULED:   { variant: 'amber',   label: 'Agendado' },
  IN_PROGRESS: { variant: 'fuchsia', label: 'Em andamento' },
  DONE:        { variant: 'green',   label: 'Concluído' },
  RATED:       { variant: 'green',   label: 'Avaliado' },
  REVIEWED:    { variant: 'green',   label: 'Avaliado' },
  CANCELLED:   { variant: 'red',     label: 'Cancelado' },
  DISPUTED:    { variant: 'red',     label: 'Em disputa' },
}

export const SCHEDULE_STATUS_BADGE: Record<string, { variant: BadgeVariant; label: string }> = {
  CONFIRMED:   { variant: 'purple',  label: 'Confirmado' },
  IN_PROGRESS: { variant: 'fuchsia', label: 'Em andamento' },
  DONE:        { variant: 'green',   label: 'Concluído' },
  CANCELLED:   { variant: 'red',     label: 'Cancelado' },
}
