import React from 'react'
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg'

interface LogoProps {
  size?: number
}

let idCounter = 0
function uniqueId() {
  idCounter += 1
  return `mc-logo-${idCounter}`
}

/**
 * Logo Missão Cumprida — ícone quadrado arredondado com degradê azul→verde
 * e checkmark branco em peso bold. Identidade visual oficial.
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
          <Stop offset="0%" stopColor="#1D4ED8" />
          <Stop offset="100%" stopColor="#059669" />
        </LinearGradient>
      </Defs>
      <Rect width={48} height={48} rx={13} fill={`url(#${gradId})`} />
      <Path
        d="M11 25L19 33L37 15"
        stroke="white"
        strokeWidth={5.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
