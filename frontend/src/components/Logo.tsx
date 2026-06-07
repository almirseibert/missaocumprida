import React from 'react'

interface LogoProps {
  size?: number
  className?: string
}

/**
 * Logo Missão Cumprida — ícone quadrado arredondado com degradê
 * azul→verde e checkmark bold em branco.
 */
export function Logo({ size = 32, className }: LogoProps) {
  // ID único do gradient por instância para evitar colisão quando
  // múltiplos logos coexistem na página (SSR + várias instâncias).
  const id = React.useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const gradId = `mc-logo-${id}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Missão Cumprida"
    >
      <defs>
        <linearGradient
          id={gradId}
          x1="0"
          y1="0"
          x2="48"
          y2="48"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${gradId})`} />
      <path
        d="M11 25L19 33L37 15"
        stroke="white"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
