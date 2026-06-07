import { InputHTMLAttributes, forwardRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helpText?: string
  leftIcon?: ReactNode
  rightSlot?: ReactNode
}

/**
 * Input alinhado ao spec do guia (seção 05).
 * - border slate2-300 (1.5px) — focus ring brand-500 + border-brand-500
 * - error: border red-400 + ring red
 * - tipografia DM Sans 14px, text slate2-900, placeholder slate2-400
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helpText, leftIcon, rightSlot, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-slate2-700">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div
          className={cn(
            'flex items-center bg-white rounded-lg border-[1.5px]',
            'focus-within:ring-2 focus-within:ring-brand-500/20',
            error
              ? 'border-red-400 focus-within:border-red-500'
              : 'border-slate2-300 focus-within:border-brand-500',
          )}
        >
          {leftIcon && (
            <div className="pl-3 pr-1 text-slate2-400 flex-shrink-0">{leftIcon}</div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'flex-1 bg-transparent px-3 py-2.5 text-sm text-slate2-900',
              'placeholder:text-slate2-400',
              'focus:outline-none',
              'disabled:text-slate2-500',
              leftIcon && 'pl-1',
              rightSlot && 'pr-1',
              className,
            )}
            {...props}
          />
          {rightSlot && (
            <div className="pl-1 pr-3 flex-shrink-0">{rightSlot}</div>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {helpText && !error && <p className="text-xs text-slate2-400">{helpText}</p>}
      </div>
    )
  },
)
Input.displayName = 'Input'
