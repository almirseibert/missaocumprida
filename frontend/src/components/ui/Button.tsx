import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'success' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  fullWidth?: boolean
}

// 6 variantes alinhadas à Identidade Visual:
//  - primary  : Azul Confiança (brand-700)
//  - success  : Verde Missão  (accent-600) — ações de conclusão/aceite
//  - secondary: cinza suave (neutro)
//  - outline  : contorno brand
//  - ghost    : transparente
//  - danger   : vermelho destrutivo
const variants = {
  primary:   'bg-brand-700 text-white hover:bg-brand-800 shadow-brand-soft focus-visible:ring-brand-500',
  success:   'bg-accent-600 text-white hover:bg-accent-700 shadow-[0_4px_16px_rgba(5,150,105,.18)] focus-visible:ring-accent-500',
  secondary: 'bg-slate2-100 text-slate2-800 hover:bg-slate2-200 focus-visible:ring-slate2-400',
  outline:   'border-[1.5px] border-slate2-300 text-slate2-700 bg-white hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50 focus-visible:ring-brand-500',
  ghost:     'text-slate2-600 hover:bg-slate2-100 hover:text-slate2-900 focus-visible:ring-slate2-400',
  danger:    'bg-red-600 text-white hover:bg-red-700 shadow-[0_4px_16px_rgba(220,38,38,.18)] focus-visible:ring-red-500',
}

const sizes = {
  sm: 'px-3.5 py-1.5 text-sm rounded-lg',
  md: 'px-4 py-2.5 text-sm rounded-lg',
  lg: 'px-6 py-3 text-base rounded-xl',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, fullWidth, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-semibold transition-all active:scale-[0.98]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'
