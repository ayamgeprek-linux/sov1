// apps/api/src/routes/import.ts
import { Router } from 'express'
import { z } from 'zod'
import { supabase, TABLES } from '../supabase/client.js'
import { authMiddleware, requireRole, AuthRequest } from '../middleware/auth.js'
import { logAudit } from '../utils/audit.js'

const router = Router()

// Schema validasi data import
const importSchema = z.array(z.object({
  sku: z.string().min(1, 'SKU wajib diisi'),
  nama_barang: z.string().min(1, 'Nama barang wajib diisi'),
  kategori: z.string().optional(),
  warna: z.string().optional(),
  size: z.string().min(1, 'Size wajib diisi'),
  stock_sistem: z.number().int().min(0).default(0),
}))

// ============================================================
// POST /api/import - Import data master (DENGAN AUDIT)
// ============================================================
router.post('/', authMiddleware, requireRole('admin'), async (req: AuthRequest, res) => {
  const startTime = Date.now()
  
  try {
    const { data, mode = 'replace' } = req.body
    
    if (!data || data.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Tidak ada data yang diimport' 
      })
    }

    // Validasi data
    const validatedData = importSchema.parse(data)

    console.log(`[Import] 📦 Importing ${validatedData.length} records, mode: ${mode}`)

    let result
    let insertedCount = 0

    if (mode === 'replace') {
      // Mode REPLACE: hapus semua data lama, insert baru
      console.log('[Import] 🗑️ Deleting all existing data...')
      
      const { error: deleteError } = await supabase
        .from(TABLES.MASTER)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')

      if (deleteError) {
        console.error('[Import] ❌ Delete error:', deleteError)
        return res.status(500).json({
          success: false,
          error: 'Gagal menghapus data lama: ' + deleteError.message
        })
      }

      // Insert batch (100 per batch)
      const batchSize = 100
      let insertedBatch = 0

      for (let i = 0; i < validatedData.length; i += batchSize) {
        const batch = validatedData.slice(i, i + batchSize)
        const { data: inserted, error: insertError } = await supabase
          .from(TABLES.MASTER)
          .insert(batch)
          .select()

        if (insertError) {
          console.error(`[Import] ❌ Insert error at batch ${i}:`, insertError)
          return res.status(500).json({
            success: false,
            error: `Gagal insert data batch ${i}: ${insertError.message}`
          })
        }

        insertedBatch += inserted?.length || 0
        console.log(`[Import] ✅ Batch ${i / batchSize + 1}: ${inserted?.length || 0} records`)
      }

      insertedCount = insertedBatch

    } else {
      // Mode UPSERT: update jika ada, insert jika baru
      let insertedBatch = 0

      for (const item of validatedData) {
        const { data: inserted, error: upsertError } = await supabase
          .from(TABLES.MASTER)
          .upsert(item, { onConflict: 'sku,size' })
          .select()

        if (upsertError) {
          console.error('[Import] ❌ Upsert error:', upsertError)
          continue
        }

        insertedBatch += inserted?.length || 0
      }

      insertedCount = insertedBatch
    }

    // ============================================================
    // 📝 AUDIT LOG - Import berhasil
    // ============================================================
    await logAudit({
      userId: req.user!.id,
      action: 'IMPORT_MASTER',
      entityType: 'temp_master',
      newData: {
        mode,
        count: insertedCount,
        total_rows: validatedData.length,
        sample: validatedData.slice(0, 5).map((item: any) => ({
          sku: item.sku,
          nama_barang: item.nama_barang,
          size: item.size
        }))
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      durationMs: Date.now() - startTime,
      statusCode: 200
    })

    res.json({ 
      success: true, 
      inserted: insertedCount,
      message: `Berhasil import ${insertedCount} data (mode: ${mode})`
    })

  } catch (error) {
    // ============================================================
    // 📝 AUDIT LOG - Import gagal
    // ============================================================
    await logAudit({
      userId: req.user?.id || 'unknown',
      action: 'IMPORT_FAILED',
      entityType: 'temp_master',
      newData: { error: (error as Error).message },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      durationMs: Date.now() - startTime,
      statusCode: 500
    })

    console.error('[Import] ❌ Error:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validasi data gagal', 
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
// GET /api/import/template - Download template Excel
// ============================================================
router.get('/template', authMiddleware, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    // Template data
    const template = [
      {
        sku: 'BRG-001',
        nama_barang: 'Kaos Polos',
        kategori: 'Pakaian',
        warna: 'Hitam',
        size: 'M',
        stock_sistem: 10
      },
      {
        sku: 'BRG-001',
        nama_barang: 'Kaos Polos',
        kategori: 'Pakaian',
        warna: 'Hitam',
        size: 'L',
        stock_sistem: 15
      },
      {
        sku: 'BRG-002',
        nama_barang: 'Jaket Hoodie',
        kategori: 'Pakaian',
        warna: 'Abu-abu',
        size: 'M',
        stock_sistem: 5
      }
    ]

    // 📝 AUDIT LOG - Download template
    await logAudit({
      userId: req.user!.id,
      action: 'TEMPLATE_DOWNLOAD',
      entityType: 'temp_master',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    })

    res.json({
      success: true,
      data: template,
      message: 'Template import data master'
    })

  } catch (error) {
    console.error('[Import] Template error:', error)
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    })
  }
})

// ============================================================
// GET /api/import/status - Cek status import terakhir
// ============================================================
router.get('/status', authMiddleware, requireRole('admin'), async (req: AuthRequest, res) => {
  try {
    // Ambil data import terakhir dari audit log
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('action', 'IMPORT_MASTER')
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) throw error

    res.json({
      success: true,
      data: data || []
    })

  } catch (error) {
    console.error('[Import] Status error:', error)
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    })
  }
})

export default router