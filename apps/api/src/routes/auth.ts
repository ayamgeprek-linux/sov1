// apps/api/src/routes/auth.ts
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import { supabase, TABLES } from '../supabase/client.js'
import { config } from '../config/index.js'
import { logAudit } from '../utils/audit.js'

const router = Router()

const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
})

// ============================================================
// POST /auth/login - PAKE SUPABASE AUTH
// ============================================================
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body)

    console.log('[Auth] Login attempt:', email)

    // 🔥 PAKE SUPABASE AUTH (bukan bcrypt)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.log('[Auth] Supabase error:', error.message)
      return res.status(401).json({
        success: false,
        error: 'Email atau password salah',
      })
    }

    if (!data.user) {
      return res.status(401).json({
        success: false,
        error: 'User tidak ditemukan',
      })
    }

    // Cek user di tabel users
    let userData

    const { data: existingUser, error: fetchError } = await supabase
      .from(TABLES.USERS)
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (fetchError) {
      console.log('[Auth] User not found in users table, creating...')

      const { data: newUser, error: createError } = await supabase
        .from(TABLES.USERS)
        .insert({
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || email.split('@')[0],
          role: data.user.user_metadata?.role || 'petugas',
        })
        .select()
        .single()

      if (createError) {
        console.error('[Auth] Create user error:', createError)
        return res.status(500).json({
          success: false,
          error: 'Gagal membuat user',
        })
      }

      userData = newUser
    } else {
      userData = existingUser
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: userData.id,
        email: userData.email,
        name: userData.name || userData.email.split('@')[0],
        role: userData.role || 'petugas',
      } as object,
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn || '7d' } as jwt.SignOptions
    )

    // Generate Refresh Token
    const refreshToken = jwt.sign(
      { id: userData.id } as object,
      config.jwt.secret + 'refresh',
      { expiresIn: '30d' } as jwt.SignOptions
    )

    // Simpan session
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const { error: sessionError } = await supabase
      .from(TABLES.SESSIONS)
      .insert({
        user_id: userData.id,
        token: token,
        refresh_token: refreshToken,
        expires_at: expiresAt.toISOString(),
        refresh_expires_at: refreshExpiresAt.toISOString(),
        ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        user_agent: req.headers['user-agent'] || 'unknown',
        device_info: req.headers['user-agent']?.split(' ').slice(0, 3).join(' ') || 'unknown',
        last_activity: new Date().toISOString(),
      })

    if (sessionError) {
      console.error('[Auth] Session error:', sessionError)
    }

    // 📝 AUDIT LOG - Login
    await logAudit({
      userId: userData.id,
      action: 'LOGIN',
      entityType: 'auth',
      newData: { email: userData.email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      statusCode: 200
    })

    res.json({
      success: true,
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name || userData.email.split('@')[0],
        role: userData.role || 'petugas',
      },
      token,
      refresh_token: refreshToken,
      expires_in: 7 * 24 * 60 * 60,
    })

  } catch (error) {
    console.error('[Auth] Login error:', error)

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validasi gagal',
        details: error.errors,
      })
    }

    res.status(500).json({
      success: false,
      error: (error as Error).message,
    })
  }
})

// ============================================================
// GET /auth/me
// ============================================================
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        error: 'No token provided' 
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const decoded = jwt.verify(token, config.jwt.secret) as {
      id: string
      email: string
      name: string
      role: string
    }

    const { data: user, error } = await supabase
      .from(TABLES.USERS)
      .select('id, email, name, role, created_at')
      .eq('id', decoded.id)
      .single()

    if (error || !user) {
      return res.status(401).json({ 
        success: false,
        error: 'User not found' 
      })
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || user.email.split('@')[0],
        role: user.role || 'staff',
        created_at: user.created_at,
      },
    })

  } catch (error) {
    console.error('[Auth] Me error:', error)
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid token' 
      })
    }

    res.status(401).json({ 
      success: false,
      error: 'Authentication failed' 
    })
  }
})

// ============================================================
// POST /auth/logout
// ============================================================
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization
    let userId = null

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      
      const { data: session } = await supabase
        .from(TABLES.SESSIONS)
        .select('user_id')
        .eq('token', token)
        .single()

      if (session) {
        userId = session.user_id
      }

      await supabase
        .from(TABLES.SESSIONS)
        .delete()
        .eq('token', token)
    }

    if (userId) {
      await logAudit({
        userId: userId,
        action: 'LOGOUT',
        entityType: 'auth',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        statusCode: 200
      })
    }

    res.json({ 
      success: true, 
      message: 'Logged out successfully' 
    })

  } catch (error) {
    console.error('[Auth] Logout error:', error)
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    })
  }
})

export default router