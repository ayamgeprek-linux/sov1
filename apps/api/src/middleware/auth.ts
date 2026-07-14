// apps/api/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-this'

export interface AuthRequest extends Request {
  user?: {
    id: string
    email: string
    name: string
    role: string
  }
}

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Ambil token dari header
    const authHeader = req.headers.authorization
    
    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        error: 'No token provided' 
      })
    }

    // Check format "Bearer <token>"
    const parts = authHeader.split(' ')
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token format. Use: Bearer <token>' 
      })
    }

    const token = parts[1]
    
    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token' 
      })
    }
    
    // Verify token
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        id: string
        email: string
        name: string
        role: string
      }
      
      if (!decoded.id) {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid token payload' 
        })
      }
      
      req.user = {
        id: decoded.id,
        email: decoded.email || 'unknown',
        name: decoded.name || 'petugas',
        role: decoded.role || 'staff'
      }
      
      console.log('[Auth] ✅ User authenticated:', req.user.email, 'Role:', req.user.role)
      
      next()
    } catch (jwtError: any) {
      console.error('[Auth] ❌ JWT Error:', jwtError.message)
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          success: false, 
          error: 'Token expired' 
        })
      }
      
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid token signature' 
        })
      }
      
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token' 
      })
    }
  } catch (error) {
    console.error('[Auth] ❌ Error:', error)
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication failed' 
    })
  }
}

export const requireRole = (role: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized - No user context' 
      })
    }
    
    // Admin bisa akses semua
    if (req.user.role === 'admin') {
      return next()
    }
    
    // Check role spesifik
    if (req.user.role !== role) {
      return res.status(403).json({ 
        success: false, 
        error: `Role "${role}" required, got "${req.user.role}"` 
      })
    }
    
    next()
  }
}

// ============================================================
// MIDDLEWARE: OPTIONAL AUTH (ga wajib login)
// ============================================================
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader) {
      return next()
    }

    const parts = authHeader.split(' ')
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return next()
    }

    const token = parts[1]
    
    if (!token || token === 'null' || token === 'undefined') {
      return next()
    }
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        id: string
        email: string
        name: string
        role: string
      }
      
      req.user = {
        id: decoded.id,
        email: decoded.email || 'unknown',
        name: decoded.name || 'petugas',
        role: decoded.role || 'staff'
      }
    } catch {
      // Token invalid, tapi lanjutin aja (optional)
    }
    
    next()
  } catch {
    next()
  }
}

// ============================================================
// MIDDLEWARE: CHECK PERMISSION
// ============================================================
export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized' 
      })
    }
    
    // Admin punya semua permission
    if (req.user.role === 'admin') {
      return next()
    }
    
    // TODO: Implement permission checking dari database
    // const hasPermission = await checkUserPermission(req.user.id, permission)
    // if (!hasPermission) {
    //   return res.status(403).json({ success: false, error: 'Forbidden' })
    // }
    
    next()
  }
}