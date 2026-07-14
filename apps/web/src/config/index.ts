export const config = {
  app: {
    name: import.meta.env.VITE_APP_NAME || 'Stock Opname',
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
    logLevel: import.meta.env.VITE_LOG_LEVEL || 'info',
  },
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  },
} as const

export type Config = typeof config