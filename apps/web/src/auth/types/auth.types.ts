export type UserRole = 'admin' | 'petugas'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface LoginResponse {
  user: User
  token: string
  expiresIn: number
}

export interface SessionData {
  user: User
  token: string
  expiresAt: number
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}