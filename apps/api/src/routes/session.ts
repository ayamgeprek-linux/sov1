// apps/api/src/routes/session.ts
import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { supabase, TABLES } from '../supabase/client.js'
import { authMiddleware } from '../middleware/auth.js'

// ============================================================
// EXTEND EXPRESS REQUEST TYPE
// ============================================================
interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    role: string
  }
}

const router = Router()

// ============================================================
// GET /api/sessions - Ambil semua session user
// ============================================================
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' })
    }

    const { data, error } = await supabase
      .from(TABLES.SESSIONS)
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    res.json({
      success: true,
      data: data || [],
      total: data?.length || 0
    })

  } catch (error) {
    console.error('[Session] Error:', error)
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

// ============================================================
// DELETE /api/sessions/:id - Logout dari session tertentu
// ============================================================
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    if (!req.user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' })
    }

    const { error } = await supabase
      .from(TABLES.SESSIONS)
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id)

    if (error) throw error

    res.json({ success: true, message: 'Session terminated' })

  } catch (error) {
    console.error('[Session] Error:', error)
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

// ============================================================
// DELETE /api/sessions - Logout dari semua session (kecuali current)
// ============================================================
router.delete('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'User not authenticated' })
    }

    const currentToken = req.headers.authorization?.replace('Bearer ', '')

    let query = supabase
      .from(TABLES.SESSIONS)
      .delete()
      .eq('user_id', req.user.id)

    if (currentToken) {
      query = query.neq('token', currentToken)
    }

    const { error } = await query

    if (error) throw error

    res.json({ success: true, message: 'All other sessions terminated' })

  } catch (error) {
    console.error('[Session] Error:', error)
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

// ============================================================
// POST /api/sessions/refresh - Refresh token
// ============================================================
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refresh_token } = req.body

    if (!refresh_token) {
      return res.status(400).json({ success: false, error: 'Refresh token required' })
    }

    // Cari session dengan refresh token
    const { data: session, error: findError } = await supabase
      .from(TABLES.SESSIONS)
      .select('*, users(*)')
      .eq('refresh_token', refresh_token)
      .single()

    if (findError || !session) {
      return res.status(401).json({ success: false, error: 'Invalid refresh token' })
    }

    // Cek expired
    if (new Date(session.refresh_expires_at) < new Date()) {
      return res.status(401).json({ success: false, error: 'Refresh token expired' })
    }

    // Generate new tokens
    const { config } = await import('../config/index.js')

    // FIX: Pastikan expiresIn dalam format yang benar
    const expiresIn = config.jwt.expiresIn || '7d'
    const refreshExpiresIn = '30d'

    const newToken = jwt.sign(
      {
        id: session.user_id,
        email: session.users.email,
        role: session.users.role,
      },
      config.jwt.secret,
      { expiresIn: expiresIn as any }
    )

    const newRefreshToken = jwt.sign(
      { id: session.user_id },
      config.jwt.secret + 'refresh',
      { expiresIn: refreshExpiresIn as any }
    )

    // Update session
    const { error: updateError } = await supabase
      .from(TABLES.SESSIONS)
      .update({
        token: newToken,
        refresh_token: newRefreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        refresh_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        last_activity: new Date().toISOString(),
      })
      .eq('id', session.id)

    if (updateError) throw updateError

    res.json({
      success: true,
      token: newToken,
      refresh_token: newRefreshToken,
      expires_in: 7 * 24 * 60 * 60
    })

  } catch (error) {
    console.error('[Session] Refresh error:', error)
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router