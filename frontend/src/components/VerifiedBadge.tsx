import { ShieldCheck } from 'lucide-react'

type Props = {
  size?: 'xs' | 'sm' | 'md'
  showLabel?: boolean
}

const SIZES = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
}

export function VerifiedBadge({ size = 'sm', showLabel = false }: Props) {
  return (
    <span
      title="Profissional Verificado"
      className={`inline-flex items-center gap-1 text-blue-600 ${showLabel ? 'bg-blue-50 px-1.5 py-0.5 rounded-full text-[10px] font-semibold' : ''}`}
    >
      <ShieldCheck className={SIZES[size]} fill="currentColor" stroke="white" strokeWidth={2.5} />
      {showLabel && <span>Verificado</span>}
    </span>
  )
}
