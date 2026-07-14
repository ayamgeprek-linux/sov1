import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from './index'

export class SupabaseConfig {
  private static instance: SupabaseClient | null = null

  static getInstance(): SupabaseClient {
    if (!this.instance) {
      const { url, anonKey } = config.supabase

      if (!url || !anonKey) {
        throw new Error(
          '[SupabaseConfig] Missing credentials. Check your .env file.'
        )
      }

      this.instance = createClient(url, anonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
        },
      })
    }
    return this.instance
  }
}