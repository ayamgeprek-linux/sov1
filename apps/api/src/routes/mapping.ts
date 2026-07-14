// apps/api/src/routes/mapping.ts
import { Router } from 'express'
import { z } from 'zod'
import { supabase, TABLES } from '../supabase/client.js'
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.js'
import { logAudit } from '../utils/audit.js'

const router = Router()

const mappingSchema = z.object({
  sku: z.string().min(1, 'SKU wajib diisi'),
  size: z.string().min(1, 'Size wajib diisi'),
  barcode: z.string().min(8, 'Barcode minimal 8 digit'),
})

// ============================================================
// POST /api/mapping - Mapping barcode (DENGAN AUDIT)
// ============================================================
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  const startTime = Date.now()
  
  try {
    const { sku, size, barcode } = mappingSchema.parse(req.body)

    // Cek apakah barcode sudah dipakai
    const { data: existing, error: checkError } = await supabase
      .from(TABLES.BARCODE)
      .select('*')
      .eq('barcode', barcode)
      .maybeSingle()

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError
    }

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        error: 'Barcode sudah digunakan untuk produk lain' 
      })
    }

    // Ambil data lama (untuk audit)
    const { data: oldData, error: oldError } = await supabase
      .from(TABLES.BARCODE)
      .select('*')
      .eq('sku', sku)
      .eq('size', size)
      .maybeSingle()

    // Simpan mapping
    const { data, error } = await supabase
      .from(TABLES.BARCODE)
      .upsert({ 
        barcode, 
        sku, 
        size,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'barcode' })
      .select()

    if (error) throw error

    // Update status_mapping di temp_master
    const { error: updateError } = await supabase
      .from(TABLES.MASTER)
      .update({ 
        status_mapping: true,
        updated_at: new Date().toISOString()
      })
      .eq('sku', sku)
      .eq('size', size)

    if (updateError) {
      console.error('[Mapping] Update master error:', updateError)
    }

    // ============================================================
    // 📝 AUDIT LOG - Mapping barcode
    // ============================================================
    await logAudit({
      userId: req.user!.id,
      action: oldData ? 'MAPPING_UPDATE' : 'MAPPING_CREATE',
      entityType: 'temp_barcode',
      entityId: `${sku}-${size}`,
      oldData: oldData || null,
      newData: {
        sku,
        size,
        barcode,
        product_name: req.body.product_name || null
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      durationMs: Date.now() - startTime,
      statusCode: 200
    })

    res.json({ 
      success: true, 
      data: data?.[0],
      message: `Barcode ${barcode} berhasil dimapping ke ${sku} - ${size}`
    })

  } catch (error) {
    // ============================================================
    // 📝 AUDIT LOG - Mapping gagal
    // ============================================================
    await logAudit({
      userId: req.user?.id || 'unknown',
      action: 'MAPPING_FAILED',
      entityType: 'temp_barcode',
      newData: { error: (error as Error).message },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      durationMs: Date.now() - startTime,
      statusCode: 500
    })

    console.error('[Mapping] POST error:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validasi gagal', 
        details: error.errors 
      })
    }
    
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    })
  }
})

// ============================================================
// GET /api/mapping/:sku/:size - Ambil mapping by SKU + Size
// ============================================================
router.get('/:sku/:size', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { sku, size } = req.params

    const { data, error } = await supabase
      .from(TABLES.BARCODE)
      .select('*')
      .eq('sku', sku)
      .eq('size', size)
      .maybeSingle()

    if (error) throw error

    // 📝 AUDIT LOG - View mapping
    await logAudit({
      userId: req.user!.id,
      action: 'MAPPING_VIEW',
      entityType: 'temp_barcode',
      entityId: `${sku}-${size}`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    })

    res.json({ success: true, data: data || null })

  } catch (error) {
    console.error('[Mapping] GET error:', error)
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

// ============================================================
// GET /api/mapping/barcode/:barcode - Ambil mapping by Barcode
// ============================================================
router.get('/barcode/:barcode', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { barcode } = req.params

    const { data, error } = await supabase
      .from(TABLES.BARCODE)
      .select('*, temp_master(nama_barang, kategori, warna, stock_sistem)')
      .eq('barcode', barcode)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      return res.status(404).json({ 
        success: false, 
        error: 'Barcode tidak ditemukan' 
      })
    }

    // 📝 AUDIT LOG - Scan barcode
    await logAudit({
      userId: req.user!.id,
      action: 'BARCODE_SCAN',
      entityType: 'temp_barcode',
      entityId: data.id,
      newData: {
        barcode: data.barcode,
        sku: data.sku,
        size: data.size
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    })

    res.json({ 
      success: true, 
      data: {
        ...data,
        product: data.temp_master
      }
    })

  } catch (error) {
    console.error('[Mapping] GET barcode error:', error)
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

// ============================================================
// DELETE /api/mapping/:id - Hapus mapping (DENGAN AUDIT)
// ============================================================
router.delete('/:id', authMiddleware, requireRole('admin'), async (req: AuthRequest, res) => {
  const startTime = Date.now()
  
  try {
    const { id } = req.params

    // Ambil data sebelum dihapus (buat audit)
    const { data: oldData, error: findError } = await supabase
      .from(TABLES.BARCODE)
      .select('*')
      .eq('id', id)
      .single()

    if (findError) {
      return res.status(404).json({ 
        success: false, 
        error: 'Mapping not found' 
      })
    }

    // Update status_mapping di temp_master jadi false
    const { error: updateError } = await supabase
      .from(TABLES.MASTER)
      .update({ 
        status_mapping: false,
        updated_at: new Date().toISOString()
      })
      .eq('sku', oldData.sku)
      .eq('size', oldData.size)

    if (updateError) {
      console.error('[Mapping] Update master error:', updateError)
    }

    const { error } = await supabase
      .from(TABLES.BARCODE)
      .delete()
      .eq('id', id)

    if (error) throw error

    // ============================================================
    // 📝 AUDIT LOG - Delete mapping
    // ============================================================
    await logAudit({
      userId: req.user!.id,
      action: 'MAPPING_DELETE',
      entityType: 'temp_barcode',
      entityId: id,
      oldData: oldData,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      durationMs: Date.now() - startTime,
      statusCode: 200
    })

    res.json({ 
      success: true, 
      message: 'Mapping berhasil dihapus' 
    })

  } catch (error) {
    console.error('[Mapping] DELETE error:', error)
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    })
  }
})

// ============================================================
// GET /api/mapping/unmapped - Ambil daftar produk belum mapping
// ============================================================
router.get('/unmapped/list', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { limit = 50, page = 1 } = req.query

    const limitNum = Math.min(parseInt(limit as string) || 50, 100)
    const pageNum = parseInt(page as string) || 1
    const offset = (pageNum - 1) * limitNum

    // Ambil produk yang belum mapping (status_mapping = false atau null)
    const { data, error, count } = await supabase
      .from(TABLES.MASTER)
      .select('*', { count: 'exact' })
      .or('status_mapping.is.null,status_mapping.eq.false')
      .order('nama_barang', { ascending: true })
      .range(offset, offset + limitNum - 1)

    if (error) throw error

    res.json({
      success: true,
      data: data || [],
      total: count || 0,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum)
      }
    })

  } catch (error) {
    console.error('[Mapping] GET unmapped error:', error)
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    })
  }
})

// ============================================================
// GET /api/mapping/mapped - Ambil daftar produk sudah mapping
// ============================================================
router.get('/mapped/list', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { limit = 50, page = 1 } = req.query

    const limitNum = Math.min(parseInt(limit as string) || 50, 100)
    const pageNum = parseInt(page as string) || 1
    const offset = (pageNum - 1) * limitNum

    // Ambil produk yang sudah mapping
    const { data, error, count } = await supabase
      .from(TABLES.MASTER)
      .select('*, temp_barcode(barcode)')
      .eq('status_mapping', true)
      .order('nama_barang', { ascending: true })
      .range(offset, offset + limitNum - 1)

    if (error) throw error

    res.json({
      success: true,
      data: data || [],
      total: count || 0,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum)
      }
    })

  } catch (error) {
    console.error('[Mapping] GET mapped error:', error)
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    })
  }
})

export default router