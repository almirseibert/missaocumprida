import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { env } from '../config/env'

interface TokenPayload {
  userId: string
  role: string
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions)
}

export function generateRefreshToken(payload: TokenPayload): string {
  // jwtid aleatório: sem ele, dois tokens emitidos no mesmo segundo para o
  // mesmo usuário saem idênticos (colisão no unique e rotação ineficaz).
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    jwtid: crypto.randomUUID(),
  } as jwt.SignOptions)
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload
}
