import React from 'react'
import Svg, { Defs, LinearGradient, Stop, Rect, Path, Circle } from 'react-native-svg'

interface LogoProps {
  size?: number
}

let idCounter = 0
function uniqueId() {
  idCounter += 1
  return `mc-logo-${idCounter}`
}

/**
 * Logo Missão Cumprida — "Selo da Missão": medalha branca com fitas e
 * check vazado sobre degradê azul→verde. Identidade visual oficial
 * (espelha frontend/src/components/Logo.tsx).
 */
export function Logo({ size = 32 }: LogoProps) {
  const gradId = React.useMemo(uniqueId, [])
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient
          id={gradId}
          x1="0"
          y1="0"
          x2="48"
          y2="48"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0%" stopColor="#1E3A8A" />
          <Stop offset="52%" stopColor="#1D4ED8" />
          <Stop offset="100%" stopColor="#059669" />
        </LinearGradient>
      </Defs>
      <Rect width={48} height={48} rx={13} fill={`url(#${gradId})`} />
      <Path
        d="M17 26L17 41L24 36L31 41L31 26Z"
        fill="white"
        fillOpacity={0.9}
      />
      <Circle cx={24} cy={19} r={11.5} fill="white" />
      <Path
        d="M18.6 19.2L22.4 23L29.6 14.8"
        stroke={`url(#${gradId})`}
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
