// apps/api/src/routes/mapping.ts
import { Router } from 'express'
import { z } from 'zod'
import { supabase, TABLES } from '../supabase/client.js'
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.js'
import { logAudit } from '../utils/audit.js'

const router = Router()

// Schema
const mappingSchema = z.object({
  sku: z.string().min(1, 'SKU wajib diisi'),
  size: z.string().min(1, 'Size wajib diisi'),
  barcode: z.string().min(4, 'Barcode minimal 4 digit'),
})

// ============================================================
// POST /api/mapping - Simpan mapping barcode
// ============================================================
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  const startTime = Date.now()

  try {
    const { sku, size, barcode } = mappingSchema.parse(req.body)

    const { data: existing, error: checkError } = await supabase
      .from(TABLES.BARCODE)
      .select('*')
      .eq('barcode', barcode)
      .maybeSingle()

    if (checkError) throw checkError

    if (existing) {
      return res.status(400).json({
        success: false,
        error: `Barcode ${barcode} sudah digunakan untuk ${existing.sku} - ${existing.size}`
      })
    }

    const { data: product, error: productError } = await supabase
      .from(TABLES.MASTER)
      .select('*')
      .eq('sku', sku)
      .eq('size', size)
      .maybeSingle()

    if (productError) throw productError

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Produk tidak ditemukan'
      })
    }

    const { data: oldData } = await supabase
      .from(TABLES.BARCODE)
      .select('*')
      .eq('sku', sku)
      .eq('size', size)
      .maybeSingle()

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

    const { data: updateData, error: updateError } = await supabase
      .from(TABLES.MASTER)
      .update({
        status_mapping: true,
        updated_at: new Date().toISOString()
      })
      .eq('sku', sku)
      .eq('size', size)
      .select()

    if (updateError) {
      console.error('[Mapping] Gagal update status_mapping:', updateError)
      throw updateError
    }

    if (!updateData || updateData.length === 0) {
      console.warn(
        `[Mapping] ⚠️ status_mapping update 0 rows affected untuk sku=${sku} size=${size}.`
      )
    }

    await logAudit({
      userId: req.user!.id,
      action: oldData ? 'MAPPING_UPDATE' : 'MAPPING_CREATE',
      entityType: 'temp_barcode',
      entityId: `${sku}-${size}`,
      oldData: oldData || null,
      newData: { sku, size, barcode },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      durationMs: Date.now() - startTime,
      statusCode: 200
    })

    res.json({
      success: true,
      data: data?.[0],
      message: `✅ Barcode ${barcode} → ${sku} (${size})`
    })

  } catch (error) {
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

    console.error('[Mapping] Error:', error)

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
// GET /api/mapping/barcode/:barcode - Cari mapping by barcode
// ============================================================
router.get('/barcode/:barcode', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { barcode } = req.params

    // Step 1: cari baris barcode-nya dulu di temp_barcode
    // (TIDAK pakai embedded select temp_master(...) lagi — itu butuh
    // FK relationship formal antar tabel yang gak selalu ke-detect
    // konsisten oleh PostgREST schema cache, dan sempat bikin PGRST200
    // di endpoint /mapped sebelumnya)
    const { data: barcodeRow, error: barcodeError } = await supabase
      .from(TABLES.BARCODE)
      .select('*')
      .eq('barcode', barcode)
      .maybeSingle()

    if (barcodeError) throw barcodeError

    if (!barcodeRow) {
      return res.status(404).json({
        success: false,
        error: 'Barcode tidak ditemukan'
      })
    }

    // Step 2: cari detail produknya secara manual dari temp_master
    // pakai sku + size yang didapat dari step 1
    const { data: product, error: productError } = await supabase
      .from(TABLES.MASTER)
      .select('nama_barang, kategori, warna, stock_sistem')
      .eq('sku', barcodeRow.sku)
      .eq('size', barcodeRow.size)
      .maybeSingle()

    if (productError) throw productError

    res.json({
      success: true,
      data: {
        ...barcodeRow,
        product: product || null
      }
    })

  } catch (error) {
    console.error('[Mapping] Get by barcode error:', error)
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

// ============================================================
// GET /api/mapping/unmapped - Produk belum mapping
// ============================================================
router.get('/unmapped', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { limit = 50, page = 1, search } = req.query

    const limitNum = Math.min(parseInt(limit as string) || 50, 100)
    const pageNum = parseInt(page as string) || 1
    const offset = (pageNum - 1) * limitNum

    let query = supabase
      .from(TABLES.MASTER)
      .select('*', { count: 'exact' })
      .or('status_mapping.is.null,status_mapping.eq.false')
      .order('nama_barang', { ascending: true })

    if (search) {
      query = query.or(`nama_barang.ilike.%${search}%,sku.ilike.%${search}%`)
    }

    const { data, error, count } = await query
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
    console.error('[Mapping] Unmapped error:', error)
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

// ============================================================
// GET /api/mapping/mapped - Produk sudah mapping
// ============================================================
router.get('/mapped', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { limit = 50, page = 1, search } = req.query

    const limitNum = Math.min(parseInt(limit as string) || 50, 100)
    const pageNum = parseInt(page as string) || 1
    const offset = (pageNum - 1) * limitNum

    let query = supabase
      .from(TABLES.MASTER)
      .select('*', { count: 'exact' })
      .eq('status_mapping', true)
      .order('nama_barang', { ascending: true })

    if (search) {
      query = query.or(`nama_barang.ilike.%${search}%,sku.ilike.%${search}%`)
    }

    const { data, error, count } = await query
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
    console.error('[Mapping] Mapped error:', error)
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router