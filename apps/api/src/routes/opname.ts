// apps/api/src/routes/opname.ts
import { Router } from 'express'
import { z } from 'zod'
import { supabase, TABLES } from '../supabase/client.js'
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.js'
import { logAudit } from '../utils/audit.js'

const router = Router()

// ============================================================
// GET /api/opname - Ambil semua data opname (TANPA JOIN)
// ============================================================
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { limit = 100, page = 1, sku, size } = req.query

    const limitNum = Math.min(parseInt(limit as string) || 100, 500)
    const pageNum = parseInt(page as string) || 1
    const offset = (pageNum - 1) * limitNum

    // 🔥 QUERY TANPA JOIN - langsung dari temp_opname
    let query = supabase
      .from(TABLES.OPNAME)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (sku) query = query.eq('sku', sku as string)
    if (size) query = query.eq('size', size as string)

    const { data, error, count } = await query
      .range(offset, offset + limitNum - 1)

    if (error) {
      console.error('[Opname] GET query error:', error)
      throw error
    }

    // 🔥 AMBIL DATA MASTER TERPISAH (manual join)
    let formattedData = data || []
    
    if (data && data.length > 0) {
      // Ambil semua SKU yang ada di opname
      const skuList = [...new Set(data.map(item => item.sku))]
      
      // Query master untuk SKU tersebut
      const { data: masterData, error: masterError } = await supabase
        .from(TABLES.MASTER)
        .select('sku, size, nama_barang, kategori, warna, stock_sistem, lokasi_rak')
        .in('sku', skuList)

      if (!masterError && masterData) {
        // Buat map master untuk akses cepat
        const masterMap = new Map()
        masterData.forEach((m: any) => {
          const key = `${m.sku}-${m.size}`
          masterMap.set(key, m)
        })

        // Gabungkan data opname dengan master
        formattedData = data.map((item: any) => {
          const key = `${item.sku}-${item.size}`
          const master = masterMap.get(key)
          return {
            ...item,
            nama_barang: master?.nama_barang || item.nama_barang || 'UNKNOWN',
            kategori: master?.kategori || item.kategori || 'UNKNOWN',
            warna: master?.warna || item.warna || 'N/A',
            stock_sistem: master?.stock_sistem || item.stock_sistem || 0,
            lokasi_rak: item.lokasi_rak || master?.lokasi_rak || null
          }
        })
      }
    }

    res.json({ 
      success: true, 
      data: formattedData || [],
      total: count || 0,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limitNum)
      }
    })
  } catch (error) {
    console.error('[Opname] GET error:', error)
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    })
  }
})

// ============================================================
// POST /api/opname - Simpan opname
// ============================================================
const opnameSchema = z.object({
  sku: z.string().min(1),
  size: z.string().min(1),
  qty_fisik: z.number().int().min(0),
  lokasi_rak: z.string().optional().nullable(),
})

router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  const startTime = Date.now()
  
  try {
    const { sku, size, qty_fisik, lokasi_rak } = opnameSchema.parse(req.body)

    console.log('[Opname] 📝 Saving:', { sku, size, qty_fisik, lokasi_rak, user: req.user?.email })

    // Ambil data lama
    const { data: oldData, error: oldError } = await supabase
      .from(TABLES.OPNAME)
      .select('*')
      .eq('sku', sku)
      .eq('size', size)
      .maybeSingle()

    if (oldError && oldError.code !== 'PGRST116') {
      console.error('[Opname] Old data error:', oldError)
    }

    // Ambil stock sistem dari master
    const { data: product, error: productError } = await supabase
      .from(TABLES.MASTER)
      .select('stock_sistem, nama_barang, kategori, warna, lokasi_rak')
      .eq('sku', sku)
      .eq('size', size)
      .maybeSingle()

    if (productError || !product) {
      return res.status(404).json({ 
        success: false, 
        error: 'Product not found' 
      })
    }

    const stockSistem = product.stock_sistem || 0
    const selisih = qty_fisik - stockSistem
    const status = selisih === 0 ? 'sesuai' : selisih > 0 ? 'masuk' : 'keluar'

    // UPSERT
    const { data, error } = await supabase
      .from(TABLES.OPNAME)
      .upsert({
        sku,
        size,
        stock_real: qty_fisik,
        selisih,
        status,
        lokasi_rak: lokasi_rak || product.lokasi_rak || null,
        user_name: req.user?.email || req.user?.name || 'Petugas',
        updated_at: new Date().toISOString()
      }, { onConflict: 'sku,size' })
      .select()

    if (error) {
      console.error('[Opname] Upsert error:', error)
      throw error
    }

    // Update master kalo ada rak
    if (lokasi_rak && lokasi_rak !== product.lokasi_rak) {
      await supabase
        .from(TABLES.MASTER)
        .update({ lokasi_rak })
        .eq('sku', sku)
        .eq('size', size)
    }

    // Audit log
    await logAudit({
      userId: req.user!.id,
      action: 'OPNAME_SCAN',
      entityType: 'temp_opname',
      entityId: `${sku}-${size}`,
      oldData: oldData ? {
        stock_real: oldData.stock_real,
        selisih: oldData.selisih,
        status: oldData.status,
        lokasi_rak: oldData.lokasi_rak
      } : null,
      newData: {
        sku,
        size,
        nama_barang: product.nama_barang,
        stock_sistem: stockSistem,
        stock_real: qty_fisik,
        selisih,
        status,
        lokasi_rak: lokasi_rak || product.lokasi_rak || null
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      durationMs: Date.now() - startTime,
      statusCode: 200
    })

    res.json({
      success: true,
      data: data?.[0],
      selisih,
      status,
      lokasi_rak: lokasi_rak || product.lokasi_rak || null,
      product: {
        nama_barang: product.nama_barang,
        kategori: product.kategori,
        warna: product.warna
      }
    })

  } catch (error) {
    console.error('[Opname] POST error:', error)
    
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
// POST /api/opname/update-rak - Update rak
// ============================================================
const updateRakSchema = z.object({
  sku: z.string().min(1),
  size: z.string().min(1),
  lokasi_rak: z.string().min(1),
})

router.post('/update-rak', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { sku, size, lokasi_rak } = updateRakSchema.parse(req.body)

    // Update di temp_opname
    const { error: opnameError } = await supabase
      .from(TABLES.OPNAME)
      .update({ 
        lokasi_rak,
        updated_at: new Date().toISOString(),
        user_name: req.user?.email || req.user?.name || 'Petugas'
      })
      .eq('sku', sku)
      .eq('size', size)

    if (opnameError) throw opnameError

    // Update di temp_master
    await supabase
      .from(TABLES.MASTER)
      .update({ lokasi_rak })
      .eq('sku', sku)
      .eq('size', size)

    // Audit log
    await logAudit({
      userId: req.user!.id,
      action: 'RAK_UPDATE',
      entityType: 'temp_opname',
      entityId: `${sku}-${size}`,
      newData: { lokasi_rak },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      durationMs: 0,
      statusCode: 200
    })

    res.json({
      success: true,
      message: `Rak ${lokasi_rak} berhasil disimpan`,
      data: { sku, size, lokasi_rak }
    })

  } catch (error) {
    console.error('[Opname] Update rak error:', error)
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    })
  }
})

// ============================================================
// POST /api/opname/size - Tambah size baru
// ============================================================
const addSizeSchema = z.object({
  sku: z.string().min(1),
  size: z.string().min(1),
  qty_fisik: z.number().int().min(0),
  nama_barang: z.string().min(1),
  kategori: z.string().optional(),
  warna: z.string().optional(),
  lokasi_rak: z.string().optional().nullable(),
})

router.post('/size', authMiddleware, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { sku, size, qty_fisik, nama_barang, kategori, warna, lokasi_rak } = addSizeSchema.parse(req.body)

    // Tambah ke master
    const { data: masterData, error: masterError } = await supabase
      .from(TABLES.MASTER)
      .insert({
        sku,
        nama_barang,
        kategori: kategori || 'UNKNOWN',
        warna: warna || 'N/A',
        size: size,
        stock_sistem: 0,
        lokasi_rak: lokasi_rak || null
      })
      .select()

    if (masterError) {
      return res.status(500).json({
        success: false,
        error: 'Gagal menambahkan size ke master'
      })
    }

    // Simpan opname
    const { data, error } = await supabase
      .from(TABLES.OPNAME)
      .insert({
        sku,
        size,
        stock_real: qty_fisik,
        selisih: qty_fisik,
        status: 'masuk',
        lokasi_rak: lokasi_rak || null,
        user_name: req.user?.email || req.user?.name || 'Petugas',
        updated_at: new Date().toISOString()
      })
      .select()

    if (error) {
      return res.status(500).json({
        success: false,
        error: 'Gagal menyimpan opname'
      })
    }

    // Audit log
    await logAudit({
      userId: req.user!.id,
      action: 'SIZE_ADD',
      entityType: 'temp_master',
      entityId: `${sku}-${size}`,
      newData: {
        sku,
        size,
        nama_barang,
        kategori: kategori || 'UNKNOWN',
        warna: warna || 'N/A',
        qty_fisik,
        lokasi_rak: lokasi_rak || null
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      durationMs: 0,
      statusCode: 200
    })

    res.json({
      success: true,
      data: data?.[0],
      master: masterData?.[0],
      message: `Size ${size} berhasil ditambahkan`
    })

  } catch (error) {
    console.error('[Opname] Add size error:', error)
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    })
  }
})

// ============================================================
// DELETE /api/opname/:id - Hapus opname
// ============================================================
router.delete('/:id', authMiddleware, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params

    const { data: oldData, error: findError } = await supabase
      .from(TABLES.OPNAME)
      .select('*')
      .eq('id', id)
      .single()

    if (findError) {
      return res.status(404).json({ 
        success: false, 
        error: 'Opname record not found' 
      })
    }

    const { error } = await supabase
      .from(TABLES.OPNAME)
      .delete()
      .eq('id', id)

    if (error) throw error

    await logAudit({
      userId: req.user!.id,
      action: 'OPNAME_DELETE',
      entityType: 'temp_opname',
      entityId: id,
      oldData: oldData,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      durationMs: 0,
      statusCode: 200
    })

    res.json({ 
      success: true, 
      message: 'Opname record deleted' 
    })

  } catch (error) {
    console.error('[Opname] DELETE error:', error)
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    })
  }
})

// ============================================================
// GET /api/opname/stats - Statistik opname (TANPA JOIN)
// ============================================================
router.get('/stats', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { count: totalOpname, error: countError } = await supabase
      .from(TABLES.OPNAME)
      .select('*', { count: 'exact', head: true })

    if (countError) throw countError

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count: todayOpname } = await supabase
      .from(TABLES.OPNAME)
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())

    // Ambil data user
    const { data: userData } = await supabase
      .from(TABLES.OPNAME)
      .select('user_name')

    const userMap = new Map<string, { name: string; scans: number }>()
    userData?.forEach((item: any) => {
      const name = item.user_name || 'Petugas'
      if (!userMap.has(name)) {
        userMap.set(name, { name, scans: 0 })
      }
      userMap.get(name)!.scans += 1
    })

    const activeUsers = Array.from(userMap.entries()).map(([_, value]) => ({
      name: value.name,
      scans: value.scans
    })).sort((a, b) => b.scans - a.scans)

    // Ambil status breakdown
    const { data: statusData } = await supabase
      .from(TABLES.OPNAME)
      .select('status')

    const statusBreakdown = { sesuai: 0, masuk: 0, keluar: 0 }
    statusData?.forEach((item: any) => {
      if (item.status === 'sesuai') statusBreakdown.sesuai++
      else if (item.status === 'masuk') statusBreakdown.masuk++
      else if (item.status === 'keluar') statusBreakdown.keluar++
    })

    // Total selisih
    const { data: selisihData } = await supabase
      .from(TABLES.OPNAME)
      .select('selisih')

    let totalSelisih = 0
    selisihData?.forEach((item: any) => {
      totalSelisih += item.selisih || 0
    })

    res.json({
      success: true,
      data: {
        total: totalOpname || 0,
        today: todayOpname || 0,
        activeUsers,
        statusBreakdown,
        totalSelisih
      }
    })

  } catch (error) {
    console.error('[Opname] Stats error:', error)
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    })
  }
})

export default router