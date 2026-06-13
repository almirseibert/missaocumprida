import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' }) // dev overrides
dotenv.config()                        // fallback to .env

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3333', 10),

  DATABASE_URL: process.env.DATABASE_URL || '',

  JWT_SECRET: process.env.JWT_SECRET || 'missao_cumprida_jwt_secret_dev',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'missao_cumprida_refresh_secret_dev',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),

  // Segurança de Transação: dias de retenção do pagamento após a confirmação
  // do cliente antes de poder ser liberado ao prestador (janela de reclamação).
  TRANSACTION_HOLD_DAYS: parseInt(process.env.TRANSACTION_HOLD_DAYS || '7', 10),

  API_URL: process.env.API_URL || 'http://localhost:3333',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',

  MP_ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN || '',
  MP_PUBLIC_KEY: process.env.MP_PUBLIC_KEY || '',
  MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET || '',
  MP_CLIENT_ID: process.env.MP_CLIENT_ID || '',
  MP_CLIENT_SECRET: process.env.MP_CLIENT_SECRET || '',
}

// ---- Guard de produção: recusa segredos fracos/conhecidos ----
// Em produção, JWT secrets precisam ser fortes e não podem ser os defaults de
// dev nem os valores antigos que já vazaram. Falha cedo (no boot) se inseguro.
if (env.NODE_ENV === 'production') {
  const WEAK_SECRETS = new Set([
    'missao_cumprida_jwt_secret_dev',
    'missao_cumprida_refresh_secret_dev',
    'missaocumprida_jwt_secret_super_segura_2024_producao',
    'missaocumprida_refresh_secret_super_segura_2024_producao',
  ])
  const problems: string[] = []
  for (const [name, value] of [
    ['JWT_SECRET', env.JWT_SECRET],
    ['JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET],
  ] as const) {
    if (!value || value.length < 32) problems.push(`${name} deve ter ao menos 32 caracteres`)
    if (WEAK_SECRETS.has(value)) problems.push(`${name} está usando um valor padrão/vazado — gere um novo (openssl rand -hex 48)`)
  }
  if (problems.length > 0) {
    throw new Error(`[CONFIG INSEGURA] ${problems.join(' | ')}`)
  }
}
