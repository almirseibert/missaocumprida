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
