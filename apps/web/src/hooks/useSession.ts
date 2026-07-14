// apps/web/src/hooks/useSession.ts
import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/contexts/AuthContext'

export function useSession() {
  const { token, logout } = useAuth()
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isIdle, setIsIdle] = useState(false)
  const [idleTime, setIdleTime] = useState(0)

  const IDLE_TIMEOUT = 15 * 60 * 1000 // 15 menit

  // ============================================================
  // GET SESSIONS
  // ============================================================
  const getSessions = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.get<{ data: any[] }>('/api/sessions', token || undefined)
      setSessions(result.data || [])
    } catch (error) {
      console.error('[useSession] Error:', error)
    } finally {
      setLoading(false)
    }
  }, [token])

  // ============================================================
  // LOGOUT SESSION
  // ============================================================
  const terminateSession = useCallback(async (sessionId: string) => {
    try {
      await api.del(`/api/sessions/${sessionId}`, token || undefined)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      return true
    } catch (error) {
      console.error('[useSession] Terminate error:', error)
      return false
    }
  }, [token])

  // ============================================================
  // LOGOUT ALL SESSIONS (except current)
  // ============================================================
  const terminateAllSessions = useCallback(async () => {
    try {
      await api.del('/api/sessions', token || undefined)
      await getSessions()
      return true
    } catch (error) {
      console.error('[useSession] Terminate all error:', error)
      return false
    }
  }, [token, getSessions])

  // ============================================================
  // IDLE DETECTION - FIX NodeJS namespace
  // ============================================================
  useEffect(() => {
    // 👇 PAKE ReturnType<typeof setTimeout> BUKAN NodeJS.Timeout
    let idleTimer: ReturnType<typeof setTimeout> | null = null
    
    const resetIdleTimer = () => {
      if (idleTimer) {
        clearTimeout(idleTimer)
      }
      setIsIdle(false)
      setIdleTime(0)
      idleTimer = setTimeout(() => {
        setIsIdle(true)
        setIdleTime(IDLE_TIMEOUT / 60000)
      }, IDLE_TIMEOUT)
    }
    
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach(event => document.addEventListener(event, resetIdleTimer))
    
    resetIdleTimer()
    
    return () => {
      events.forEach(event => document.removeEventListener(event, resetIdleTimer))
      if (idleTimer) {
        clearTimeout(idleTimer)
      }
    }
  }, [IDLE_TIMEOUT])

  // ============================================================
  // AUTO REFRESH SESSION
  // ============================================================
  useEffect(() => {
    const refreshInterval = setInterval(async () => {
      if (isIdle) {
        // Auto logout kalo idle > 15 menit
        await logout()
        window.location.href = '/login'
      }
    }, 60000)

    return () => clearInterval(refreshInterval)
  }, [isIdle, logout])

  return {
    sessions,
    loading,
    isIdle,
    idleTime,
    getSessions,
    terminateSession,
    terminateAllSessions,
  }
}