// apps/api/src/supabase/client.ts
import { createClient } from '@supabase/supabase-js'
import { config } from '../config/index.js'

const { url, serviceKey } = config.supabase

if (!url || !serviceKey) {
  console.error('❌ ERROR: Supabase credentials missing!')
  console.error('   URL:', url)
  console.error('   SERVICE_KEY:', serviceKey ? 'exists' : 'missing')
}

console.log('[Supabase] Creating client...')

export const supabase = createClient(
  url || '',
  serviceKey || '',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  }
)

export const TABLES = {
  MASTER: 'temp_master',
  BARCODE: 'temp_barcode',
  OPNAME: 'temp_opname',
  USERS: 'users',
  AUDIT_LOG: 'audit_log',
  SESSIONS: 'sessions',  // 👈 TAMBAH INI
} as const

console.log('[Supabase] Client created ✅')