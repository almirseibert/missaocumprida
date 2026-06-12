import React from 'react'

interface LogoProps {
  size?: number
  className?: string
}

/**
 * Logo Missão Cumprida — "Selo da Missão": medalha branca com fitas e
 * check vazado sobre degradê azul→verde. A medalha diz "confiança e
 * reputação"; o check diz "missão cumprida". O check usa o próprio
 * degradê (userSpaceOnUse) para simular recorte no selo.
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
          <stop offset="0%" stopColor="#1E3A8A" />
          <stop offset="52%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${gradId})`} />
      <path
        d="M17 26L17 41L24 36L31 41L31 26Z"
        fill="white"
        fillOpacity="0.9"
      />
      <circle cx="24" cy="19" r="11.5" fill="white" />
      <path
        d="M18.6 19.2L22.4 23L29.6 14.8"
        stroke={`url(#${gradId})`}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
