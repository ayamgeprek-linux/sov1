// apps/api/src/config/index.ts
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env dari root API
const envPath = path.resolve(__dirname, '../../.env')
console.log('[Config] Loading .env from:', envPath)

const result = dotenv.config({ path: envPath })

if (result.error) {
  console.error('[Config] Error loading .env:', result.error)
} else {
  console.log('[Config] .env loaded successfully')
}

export const config = {
  port: parseInt(process.env.PORT || '3001'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'super-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  },
}

console.log('[Config] Loaded:')
console.log(`  SUPABASE_URL: ${config.supabase.url ? '✅' : '❌'}`)
console.log(`  SUPABASE_SERVICE_KEY: ${config.supabase.serviceKey ? '✅' : '❌'}`)
console.log(`  PORT: ${config.port}`)