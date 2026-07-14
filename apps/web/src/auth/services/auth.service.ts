import { User, LoginCredentials, LoginResponse, UserRole } from '../types/auth.types'
import { SessionService } from './session.service'
import { AuthValidator } from '../utils/auth.validator'
import { ROLES } from '../constants/auth.constants'
import { logger } from '../../utils/logger'

// Mock users - replace with Supabase later
const MOCK_USERS: User[] = [
  {
    id: '1',
    name: 'Budi Santoso',
    email: 'admin@opname.com',
    role: ROLES.ADMIN,
    avatar: 'BS',
  },
  {
    id: '2',
    name: 'Rina Pratiwi',
    email: 'petugas@opname.com',
    role: ROLES.PETUGAS,
    avatar: 'RP',
  },
]

export class AuthService {
  private static instance: AuthService
  private sessionService: SessionService
  private loginAttempts: Map<string, number> = new Map()
  private lockoutTime: Map<string, number> = new Map()

  private constructor() {
    this.sessionService = SessionService.getInstance()
  }

  static getInstance(): AuthService {
    if (!this.instance) {
      this.instance = new AuthService()
    }
    return this.instance
  }

  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    logger.info('[AuthService] Login attempt for:', credentials.email)

    const validation = AuthValidator.validateLoginForm(
      credentials.email,
      credentials.password
    )

    if (!validation.valid) {
      throw new Error(Object.values(validation.errors)[0])
    }

    if (this.isLocked(credentials.email)) {
      throw new Error('Akun terkunci. Coba lagi nanti.')
    }

    const user = MOCK_USERS.find((u) => u.email === credentials.email)

    if (!user) {
      this.recordFailedAttempt(credentials.email)
      throw new Error('Email atau password salah')
    }

    if (credentials.password !== 'password123') {
      this.recordFailedAttempt(credentials.email)
      throw new Error('Email atau password salah')
    }

    this.loginAttempts.delete(credentials.email)
    this.lockoutTime.delete(credentials.email)

    const token = this.generateToken(user)
    this.sessionService.saveSession(user, token)

    logger.info('[AuthService] Login successful for:', user.email)

    return {
      user,
      token,
      expiresIn: 8 * 60 * 60,
    }
  }

  async logout(): Promise<void> {
    this.sessionService.clearSession()
    logger.info('[AuthService] Logout successful')
  }

  async getCurrentUser(): Promise<User | null> {
    return this.sessionService.getUser()
  }

  async isAuthenticated(): Promise<boolean> {
    return this.sessionService.isAuthenticated()
  }

  async refreshSession(): Promise<void> {
    this.sessionService.refreshSession()
  }

  hasRole(requiredRole: UserRole | UserRole[]): boolean {
    const user = this.sessionService.getUser()
    if (!user) return false

    if (Array.isArray(requiredRole)) {
      return requiredRole.includes(user.role)
    }

    return user.role === requiredRole
  }

  private generateToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
    }
    return btoa(JSON.stringify(payload))
  }

  private recordFailedAttempt(email: string): void {
    const attempts = (this.loginAttempts.get(email) || 0) + 1
    this.loginAttempts.set(email, attempts)

    if (attempts >= 5) {
      this.lockoutTime.set(email, Date.now() + 15 * 60 * 1000)
      logger.warn('[AuthService] Account locked for:', email)
    }
  }

  private isLocked(email: string): boolean {
    const lockoutEnd = this.lockoutTime.get(email)
    if (!lockoutEnd) return false

    if (Date.now() > lockoutEnd) {
      this.lockoutTime.delete(email)
      this.loginAttempts.delete(email)
      return false
    }

    return true
  }

  getRemainingLockoutTime(email: string): number {
    const lockoutEnd = this.lockoutTime.get(email)
    if (!lockoutEnd) return 0

    const remaining = Math.max(0, lockoutEnd - Date.now())
    return Math.ceil(remaining / 60000)
  }
}