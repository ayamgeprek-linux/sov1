export const AUTH_CONSTANTS = {
  SESSION_KEY: 'stock_opname_session',
  TOKEN_KEY: 'stock_opname_token',
  USER_KEY: 'stock_opname_user',
  SESSION_TIMEOUT: 8 * 60 * 60 * 1000, // 8 hours
  LOGIN_ATTEMPTS_MAX: 5,
  LOGIN_LOCKOUT_TIME: 15 * 60 * 1000, // 15 minutes
} as const

export const ROLES = {
  ADMIN: 'admin',
  PETUGAS: 'petugas',
} as const

export const ROLE_LABELS = {
  admin: 'Administrator',
  petugas: 'Petugas Opname',
} as const

export const DEFAULT_ROUTES = {
  admin: '/dashboard',
  petugas: '/opname',
} as const