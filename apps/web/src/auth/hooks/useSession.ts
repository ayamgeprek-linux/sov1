import { useState, useEffect } from 'react'
import { SessionService } from '../services/session.service'
import { User } from '../types/auth.types'

const sessionService = SessionService.getInstance()

export function useSession() {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)

  useEffect(() => {
    const checkSession = () => {
      const session = sessionService.getSession()
      setUser(session?.user || null)
      setIsAuthenticated(!!session)
    }

    checkSession()

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'stock_opname_session') {
        checkSession()
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  return {
    user,
    isAuthenticated,
    refreshSession: () => sessionService.refreshSession(),
    clearSession: () => sessionService.clearSession(),
    updateUser: (user: User) => sessionService.updateUser(user),
  }
}