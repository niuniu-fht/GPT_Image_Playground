import dotenv from 'dotenv'

dotenv.config()

function readNumber(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) ? value : fallback
}

export const env = {
  port: readNumber('PORT', 8787),
  databaseUrl: process.env.DATABASE_URL || '',
  sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret-change-me',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiBaseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/+$/, ''),
  squareApiUrl: (process.env.SQUARE_API_URL || '').replace(/\/+$/, ''),
  squareAdminToken: process.env.SQUARE_ADMIN_TOKEN || '',
  r2Endpoint: (process.env.R2_ENDPOINT || '').replace(/\/+$/, ''),
  r2AccessKey: process.env.R2_ACCESS_KEY_ID || '',
  r2SecretKey: process.env.R2_SECRET_ACCESS_KEY || '',
  r2Bucket: process.env.R2_BUCKET || '',
  r2PublicBaseUrl: (process.env.R2_PUBLIC_BASE_URL || process.env.PUBLIC_ASSET_BASE_URL || '').replace(/\/+$/, ''),
  frontendOrigins: (process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:5173,http://127.0.0.1:5174,http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
  registerBonusCredits: readNumber('REGISTER_BONUS_CREDITS', 100),
}
