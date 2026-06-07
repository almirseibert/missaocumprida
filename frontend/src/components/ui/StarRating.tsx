'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  value?: number
  onChange?: (value: number) => void
  readonly?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const starSize = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-7 h-7' }

export function StarRating({ value = 0, onChange, readonly = false, size = 'md' }: StarRatingProps) {
  const [hover, setHover] = useState(0)

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = (hover || value) >= star
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !readonly && setHover(star)}
            onMouseLeave={() => !readonly && setHover(0)}
            className={cn('transition-colors', !readonly && 'cursor-pointer')}
          >
            <Star
              className={cn(
                starSize[size],
                filled ? 'fill-amber-400 text-amber-400' : 'fill-slate2-200 text-slate2-200'
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
