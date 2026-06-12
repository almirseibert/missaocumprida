import { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Nível de elevação conforme seção 08 do guia (0–4). */
  elevation?: 0 | 1 | 2 | 3 | 4
  /** Remove a borda padrão. */
  noBorder?: boolean
  /** Adiciona realce de borda + sombra ao passar o mouse (cards clicáveis). */
  hoverable?: boolean
}

// Tokens de elevação definidos no tailwind.config.js (boxShadow: elv-1..4).
const elevations: Record<NonNullable<CardProps['elevation']>, string> = {
  0: '',
  1: 'shadow-elv-1',
  2: 'shadow-elv-2',
  3: 'shadow-elv-3',
  4: 'shadow-elv-4',
}

export function Card({
  className,
  elevation = 1,
  noBorder = false,
  hoverable = false,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl transition-all',
        !noBorder && 'border border-slate2-200',
        elevations[elevation],
        hoverable && 'hover:border-brand-300 hover:shadow-brand-soft hover:-translate-y-0.5',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 border-b border-slate2-100', className)} {...props} />
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 border-t border-slate2-100', className)} {...props} />
}
