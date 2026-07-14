// apps/web/src/auth/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '../../api/client'

interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'petugas' | 'staff'
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  error: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
  token: string | null
  refreshUser: () => Promise<void>
}

interface LoginResponse {
  success: boolean
  user: User
  token: string
  refresh_token?: string
  expires_in?: number
  error?: string // 👈 TAMBAHKAN INI
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('token')
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ============================================================
  // FETCH USER PROFILE
  // ============================================================
  const fetchUserProfile = useCallback(async (authToken: string) => {
    try {
      console.log('[Auth] Fetching user profile...')
      
      const result = await api.get<{ success: boolean; user: User }>(
        '/auth/me',
        authToken
      )

      console.log('[Auth] Profile result:', result)

      if (result?.success && result?.user) {
        setUser({
          id: result.user.id,
          email: result.user.email,
          name: result.user.name || result.user.email.split('@')[0],
          role: result.user.role as 'admin' | 'petugas' | 'staff',
        })
        console.log('[Auth] User loaded:', result.user.name)
        return true
      } else {
        console.error('[Auth] Invalid profile response:', result)
        return false
      }
    } catch (err) {
      console.error('[Auth] Fetch profile error:', err)
      return false
    }
  }, [])

  // ============================================================
  // CEK SESSION
  // ============================================================
  useEffect(() => {
    const checkSession = async () => {
      setIsLoading(true)
      
      if (!token) {
        console.log('[Auth] No token found')
        setIsLoading(false)
        return
      }

      console.log('[Auth] Checking session with token:', token ? '✅ ada' : '❌ tidak ada')

      const success = await fetchUserProfile(token)
      
      if (!success) {
        console.log('[Auth] Session invalid, clearing token')
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
      }

      setIsLoading(false)
    }

    checkSession()
  }, [token, fetchUserProfile])

  // ============================================================
  // LOGIN
  // ============================================================
  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)

    try {
      console.log('[Auth] Login attempt:', email)

      const result = await api.post<LoginResponse>('/auth/login', { email, password })

      console.log('[Auth] Login result:', result)

      // 👇 CEK ERROR DARI RESPONSE
      if (result?.error) {
        throw new Error(result.error)
      }

      if (!result?.success) {
        throw new Error(result?.error || 'Login gagal')
      }

      if (!result.token) {
        throw new Error('Token tidak ditemukan dalam response')
      }

      // Simpan token
      localStorage.setItem('token', result.token)
      if (result.refresh_token) {
        localStorage.setItem('refresh_token', result.refresh_token)
      }

      setToken(result.token)
      setUser({
        id: result.user.id,
        email: result.user.email,
        name: result.user.name || result.user.email.split('@')[0],
        role: result.user.role as 'admin' | 'petugas' | 'staff',
      })

      console.log('[Auth] Login success:', result.user.email)
    } catch (err) {
      const message = (err as Error).message || 'Login gagal'
      setError(message)
      console.error('[Auth] Login error:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ============================================================
  // LOGOUT
  // ============================================================
  const logout = useCallback(async () => {
    setIsLoading(true)
    
    try {
      if (token) {
        await api.post('/auth/logout', {}, token)
      }
    } catch (err) {
      console.error('[Auth] Logout API error:', err)
    } finally {
      localStorage.removeItem('token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
      setToken(null)
      setUser(null)
      setIsLoading(false)
      console.log('[Auth] Logout success')
    }
  }, [token])

  // ============================================================
  // REFRESH USER
  // ============================================================
  const refreshUser = useCallback(async () => {
    if (!token) {
      console.log('[Auth] No token to refresh')
      return
    }

    await fetchUserProfile(token)
  }, [token, fetchUserProfile])

  // ============================================================
  // CLEAR ERROR
  // ============================================================
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const value: AuthContextType = {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    token,
    login,
    logout,
    clearError,
    refreshUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}