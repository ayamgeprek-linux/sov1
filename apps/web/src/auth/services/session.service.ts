import { User, SessionData } from '../types/auth.types'
import { AUTH_CONSTANTS } from '../constants/auth.constants'
import { logger } from '../../utils/logger'

export class SessionService {
  private static instance: SessionService

  static getInstance(): SessionService {
    if (!this.instance) {
      this.instance = new SessionService()
    }
    return this.instance
  }

  saveSession(user: User, token: string): void {
    try {
      const sessionData: SessionData = {
        user,
        token,
        expiresAt: Date.now() + AUTH_CONSTANTS.SESSION_TIMEOUT,
      }

      localStorage.setItem(AUTH_CONSTANTS.SESSION_KEY, JSON.stringify(sessionData))
      localStorage.setItem(AUTH_CONSTANTS.USER_KEY, JSON.stringify(user))
      localStorage.setItem(AUTH_CONSTANTS.TOKEN_KEY, token)

      logger.info('[SessionService] Session saved for user:', user.email)
    } catch (error) {
      logger.error('[SessionService] Failed to save session:', error)
      throw new Error('Gagal menyimpan session')
    }
  }

  getSession(): SessionData | null {
    try {
      const sessionData = localStorage.getItem(AUTH_CONSTANTS.SESSION_KEY)
      if (!sessionData) return null

      const parsed: SessionData = JSON.parse(sessionData)

      // Check if session expired
      if (Date.now() > parsed.expiresAt) {
        this.clearSession()
        logger.info('[SessionService] Session expired for user:', parsed.user.email)
        return null
      }

      return parsed
    } catch (error) {
      logger.error('[SessionService] Failed to get session:', error)
      return null
    }
  }

  getUser(): User | null {
    try {
      const userData = localStorage.getItem(AUTH_CONSTANTS.USER_KEY)
      if (!userData) return null
      return JSON.parse(userData)
    } catch (error) {
      logger.error('[SessionService] Failed to get user:', error)
      return null
    }
  }

  getToken(): string | null {
    return localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY)
  }

  clearSession(): void {
    try {
      localStorage.removeItem(AUTH_CONSTANTS.SESSION_KEY)
      localStorage.removeItem(AUTH_CONSTANTS.USER_KEY)
      localStorage.removeItem(AUTH_CONSTANTS.TOKEN_KEY)
      logger.info('[SessionService] Session cleared')
    } catch (error) {
      logger.error('[SessionService] Failed to clear session:', error)
    }
  }

  isAuthenticated(): boolean {
    const session = this.getSession()
    return !!session
  }

  refreshSession(): void {
    const session = this.getSession()
    if (session) {
      // Extend session
      session.expiresAt = Date.now() + AUTH_CONSTANTS.SESSION_TIMEOUT
      localStorage.setItem(AUTH_CONSTANTS.SESSION_KEY, JSON.stringify(session))
      logger.info('[SessionService] Session refreshed for user:', session.user.email)
    }
  }

  updateUser(user: User): void {
    try {
      const session = this.getSession()
      if (session) {
        session.user = user
        localStorage.setItem(AUTH_CONSTANTS.SESSION_KEY, JSON.stringify(session))
        localStorage.setItem(AUTH_CONSTANTS.USER_KEY, JSON.stringify(user))
        logger.info('[SessionService] User updated:', user.email)
      }
    } catch (error) {
      logger.error('[SessionService] Failed to update user:', error)
    }
  }
}