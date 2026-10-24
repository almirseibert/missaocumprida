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

  // DEPRECATED (Remap 2.0): usado apenas pelo escrow legado até zerar HELD.
  TRANSACTION_HOLD_DAYS: parseInt(process.env.TRANSACTION_HOLD_DAYS || '7', 10),

  // ---- Taxa de Conexão (Remap 2.0) ----
  // Defaults de primeira carga. Os valores VIGENTES moram em PlatformSetting
  // (tabela platform_settings) e são editáveis pelo admin em runtime.
  CONNECTION_FEE_CLIENT_PCT: parseFloat(process.env.CONNECTION_FEE_CLIENT_PCT || '0.05'),
  CONNECTION_FEE_PROVIDER_PCT: parseFloat(process.env.CONNECTION_FEE_PROVIDER_PCT || '0.05'),
  CONNECTION_FEE_REGULAR_PCT: parseFloat(process.env.CONNECTION_FEE_REGULAR_PCT || '0.10'),
  CONNECTION_FEE_MIN: parseFloat(process.env.CONNECTION_FEE_MIN || '4.90'),
  PROVIDER_FEE_TIMEOUT_HOURS: parseFloat(process.env.PROVIDER_FEE_TIMEOUT_HOURS || '24'),
  PROPOSAL_MIN_RATIO: parseFloat(process.env.PROPOSAL_MIN_RATIO || '0.40'),

  // Gate do fluxo de Taxa de Conexão: ligado quando o Mercado Pago está
  // configurado (ou forçado com FEES_ENABLED=true para testar sem gateway).
  FEES_ENABLED: !!process.env.MP_ACCESS_TOKEN || process.env.FEES_ENABLED === 'true',

  API_URL: process.env.API_URL || 'http://localhost:3333',
  // Quantos proxies reversos ficam na frente da API (EasyPanel/Traefik = 1).
  TRUST_PROXY_HOPS: parseInt(process.env.TRUST_PROXY_HOPS || '1', 10),
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

  MP_ACCESS_TOKEN: process.env.MP_ACCESS_TOKEN || '',
  MP_PUBLIC_KEY: process.env.MP_PUBLIC_KEY || '',
  MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET || '',
  MP_CLIENT_ID: process.env.MP_CLIENT_ID || '',
  MP_CLIENT_SECRET: process.env.MP_CLIENT_SECRET || '',

  // Senha do usuário admin criado pelo seed. NUNCA hardcode em produção.
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@missaocumprida.com.br',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',

  // RevenueCat (Google Play Billing). Segredo compartilhado exigido no header
  // Authorization do webhook da RevenueCat → autentica os eventos de assinatura.
  REVENUECAT_WEBHOOK_AUTH: process.env.REVENUECAT_WEBHOOK_AUTH || '',

  // Rotas /payments/*/simulate (confirmam pagamento sem gateway). Só ligam com
  // opt-in explícito, fora de produção e SEM token real do Mercado Pago —
  // nunca dependem apenas de NODE_ENV estar configurado corretamente.
  PAYMENT_SIMULATION_ENABLED:
    process.env.ALLOW_PAYMENT_SIMULATION === 'true' &&
    !process.env.MP_ACCESS_TOKEN &&
    (process.env.NODE_ENV || 'development') !== 'production',

  // Serviços recorrentes (assinatura cliente↔prestador). Desligado até o fluxo
  // passar a cobrar a Taxa de Conexão em cada ocorrência.
  RECURRING_ENABLED: process.env.RECURRING_ENABLED === 'true',

  // Chave do hash do CPF (cpf_registry). Defina uma vez e não troque.
  CPF_HASH_KEY: process.env.CPF_HASH_KEY || '',

  // Geocodificação de endereço (endereço ↔ coordenadas). 'nominatim' (OSM,
  // gratuito, 1 req/s) ou 'none' para desligar chamadas externas (testes).
  GEOCODER: (process.env.GEOCODER || 'nominatim') as 'nominatim' | 'none',
  NOMINATIM_USER_AGENT:
    process.env.NOMINATIM_USER_AGENT || 'MissaoCumprida/1.0 (+https://missaocumprida-front.oehpg2.easypanel.host)',
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
