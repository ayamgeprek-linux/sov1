// apps/api/src/routes/audit.ts
import { Router } from 'express'
import { supabase, TABLES } from '../supabase/client.js'
import { authMiddleware, AuthRequest } from '../middleware/auth.js'

const router = Router()

// ============================================================
// GET /api/audit - Ambil semua audit log
// ============================================================
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    console.log('[Audit] 📝 Fetching audit logs...')
    console.log('[Audit] User:', req.user?.email)

    const { limit = 50, page = 1, action, entity_type, from, to } = req.query

    let query = supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (action) query = query.eq('action', action)
    if (entity_type) query = query.eq('entity_type', entity_type)
    if (from) query = query.gte('created_at', `${from}T00:00:00.000Z`)
    if (to) query = query.lte('created_at', `${to}T23:59:59.999Z`)

    const limitNum = Math.min(parseInt(limit as string) || 50, 100)
    const pageNum = parseInt(page as string) || 1
    const offset = (pageNum - 1) * limitNum

    query = query.range(offset, offset + limitNum - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('[Audit] ❌ Query error:', error)
      throw error
    }

    console.log('[Audit] ✅ Found:', data?.length || 0, 'records')

    res.json({
      success: true,
      data: data || [],
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum)
      }
    })

  } catch (error) {
    console.error('[Audit] ❌ Error:', error)
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    })
  }
})

// ============================================================
// GET /api/audit/summary/stats - Summary audit
// ============================================================
router.get('/summary/stats', authMiddleware, async (req: AuthRequest, res) => {
  try {
    console.log('[Audit] 📊 Fetching summary stats...')

    // Total semua
    const { count: total } = await supabase
      .from('audit_log')
      .select('*', { count: 'exact', head: true })

    // Hari ini
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count: todayCount } = await supabase
      .from('audit_log')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())

    // Minggu ini
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const { count: weekCount } = await supabase
      .from('audit_log')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString())

    // Bulan ini
    const monthAgo = new Date()
    monthAgo.setDate(monthAgo.getDate() - 30)
    const { count: monthCount } = await supabase
      .from('audit_log')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', monthAgo.toISOString())

    res.json({
      success: true,
      data: {
        today: todayCount || 0,
        week: weekCount || 0,
        month: monthCount || 0,
        total: total || 0
      }
    })

  } catch (error) {
    console.error('[Audit] ❌ Summary error:', error)
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    })
  }
})

export default router