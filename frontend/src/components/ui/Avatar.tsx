import Image from 'next/image'
import { cn, getAvatarUrl, getInitials } from '@/lib/utils'

interface AvatarProps {
  name: string
  avatar?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizes = { sm: 32, md: 40, lg: 56, xl: 80 }
const sizeClass = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
}

export function Avatar({ name, avatar, size = 'md', className }: AvatarProps) {
  const url = getAvatarUrl(avatar)
  const px = sizes[size]

  return (
    <div
      className={cn(
        'relative rounded-full overflow-hidden flex items-center justify-center bg-brand-100 text-brand-700 font-semibold flex-shrink-0',
        sizeClass[size],
        className
      )}
    >
      {url ? (
        <Image src={url} alt={name} width={px} height={px} className="object-cover w-full h-full" />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  )
}
