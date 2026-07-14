// apps/api/src/routes/report.ts
import { Router } from 'express'
import { supabase, TABLES } from '../supabase/client.js'

const router = Router()

// ============================================================
// GET /api/report - Laporan Lengkap (LIMIT 5000)
// ============================================================
router.get('/', async (req, res) => {
  try {
    console.log('[Report] Fetching all data (limit 5000)...')

    // ==========================================================
    // 🔥 PAKE LIMIT 5000 (BIAR AMBIL SEMUA)
    // ==========================================================
    const { data: masterData, error: masterError } = await supabase
      .from(TABLES.MASTER)
      .select('*')
      .order('nama_barang', { ascending: true })
      .limit(5000) // 👈 LIMIT 5000

    if (masterError) {
      console.error('[Report] Master error:', masterError)
      throw masterError
    }

    console.log('[Report] Master data fetched:', masterData?.length || 0)

    // ==========================================================
    // AMBIL DATA OPNAME (LIMIT 5000)
    // ==========================================================
    const { data: opnameData, error: opnameError } = await supabase
      .from(TABLES.OPNAME)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000) // 👈 LIMIT 5000

    if (opnameError) {
      console.error('[Report] Opname error:', opnameError)
      throw opnameError
    }

    console.log('[Report] Opname data fetched:', opnameData?.length || 0)

    // ==========================================================
    // GABUNGKAN DATA
    // ==========================================================
    const reportData = masterData?.map((item: any) => {
      const opname = opnameData?.find((o: any) => o.sku === item.sku && o.size === item.size)
      
      return {
        sku: item.sku,
        nama_barang: item.nama_barang || 'UNKNOWN',
        kategori: item.kategori || 'UNKNOWN',
        warna: item.warna || 'N/A',
        size: item.size || 'OS',
        stock_sistem: item.stock_sistem || 0,
        stock_real: opname?.stock_real ?? null,
        selisih: opname?.selisih ?? null,
        status: opname?.status || 'belum',
        user_name: opname?.user_name || null,
        created_at: opname?.created_at || null,
        updated_at: opname?.updated_at || null
      }
    }) || []

    // ==========================================================
    // HITUNG SUMMARY
    // ==========================================================
    const summary = {
      total_items: reportData.length,
      opnamed: reportData.filter((r: any) => r.status !== 'belum').length,
      belum: reportData.filter((r: any) => r.status === 'belum').length,
      sesuai: reportData.filter((r: any) => r.status === 'sesuai').length,
      minus: reportData.filter((r: any) => r.status === 'keluar').length,
      plus: reportData.filter((r: any) => r.status === 'masuk').length,
      total_selisih: reportData.reduce((acc: number, r: any) => acc + (r.selisih || 0), 0)
    }

    console.log('[Report] Summary:', summary)
    console.log('[Report] Total data dikirim:', reportData.length)

    res.json({
      success: true,
      data: reportData,
      total: reportData.length,
      summary: summary
    })

  } catch (error) {
    console.error('[Report] Error:', error)
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    })
  }
})

// ============================================================
// GET /api/report/summary - Ringkasan Laporan
// ============================================================
router.get('/summary', async (req, res) => {
  try {
    // Total master (limit 5000)
    const { data: masterData, error: masterError } = await supabase
      .from(TABLES.MASTER)
      .select('*')
      .limit(5000)

    if (masterError) throw masterError

    // Total opname (limit 5000)
    const { data: opnameData, error: opnameError } = await supabase
      .from(TABLES.OPNAME)
      .select('*')
      .limit(5000)

    if (opnameError) throw opnameError

    const totalItems = masterData?.length || 0
    const totalOpname = opnameData?.length || 0

    // Status breakdown
    const statusCount = {
      sesuai: 0,
      keluar: 0,
      masuk: 0
    }
    let totalSelisih = 0

    opnameData?.forEach((item: any) => {
      if (item.status === 'sesuai') statusCount.sesuai++
      else if (item.status === 'keluar') statusCount.keluar++
      else if (item.status === 'masuk') statusCount.masuk++
      totalSelisih += item.selisih || 0
    })

    res.json({
      success: true,
      data: {
        total_items: totalItems,
        total_opname: totalOpname,
        belum: totalItems - totalOpname,
        status: statusCount,
        total_selisih: totalSelisih,
        progress: totalItems ? Math.round((totalOpname / totalItems) * 100) : 0
      }
    })

  } catch (error) {
    console.error('[Report] Summary error:', error)
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    })
  }
})

// ============================================================
// GET /api/report/export - Export Laporan
// ============================================================
router.get('/export', async (req, res) => {
  try {
    const format = req.query.format || 'json'
    
    const { data: masterData, error: masterError } = await supabase
      .from(TABLES.MASTER)
      .select('*')
      .order('nama_barang', { ascending: true })
      .limit(5000)

    if (masterError) throw masterError

    const { data: opnameData, error: opnameError } = await supabase
      .from(TABLES.OPNAME)
      .select('*')
      .limit(5000)

    if (opnameError) throw opnameError

    const reportData = masterData?.map((item: any) => {
      const opname = opnameData?.find((o: any) => o.sku === item.sku && o.size === item.size)
      return {
        sku: item.sku,
        nama_barang: item.nama_barang,
        kategori: item.kategori,
        size: item.size || 'OS',
        stock_sistem: item.stock_sistem || 0,
        stock_real: opname?.stock_real || null,
        selisih: opname?.selisih || null,
        status: opname?.status || 'belum'
      }
    }) || []

    if (format === 'csv') {
      const headers = ['SKU', 'Nama Barang', 'Kategori', 'Size', 'Stock Sistem', 'Stock Real', 'Selisih', 'Status']
      const rows = reportData.map((r: any) => [
        r.sku, r.nama_barang, r.kategori, r.size, 
        r.stock_sistem, r.stock_real || '', r.selisih || '', r.status
      ])
      
      let csv = headers.join(',') + '\n'
      rows.forEach((row: any[]) => {
        csv += row.join(',') + '\n'
      })

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename=laporan-${new Date().toISOString().slice(0,10)}.csv`)
      return res.send(csv)
    }

    res.json({
      success: true,
      data: reportData,
      generated_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('[Report] Export error:', error)
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    })
  }
})

// ============================================================
// GET /api/report/by-sku/:sku - Laporan per SKU
// ============================================================
router.get('/by-sku/:sku', async (req, res) => {
  try {
    const { sku } = req.params

    const { data: masterData, error: masterError } = await supabase
      .from(TABLES.MASTER)
      .select('*')
      .eq('sku', sku)
      .limit(5000)

    if (masterError) throw masterError

    if (!masterData || masterData.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'SKU tidak ditemukan'
      })
    }

    const { data: opnameData, error: opnameError } = await supabase
      .from(TABLES.OPNAME)
      .select('*')
      .eq('sku', sku)
      .limit(5000)

    if (opnameError) throw opnameError

    const reportData = masterData.map((item: any) => {
      const opname = opnameData?.find((o: any) => o.size === item.size)
      return {
        sku: item.sku,
        nama_barang: item.nama_barang,
        kategori: item.kategori,
        warna: item.warna,
        size: item.size || 'OS',
        stock_sistem: item.stock_sistem || 0,
        stock_real: opname?.stock_real || null,
        selisih: opname?.selisih || null,
        status: opname?.status || 'belum'
      }
    })

    res.json({
      success: true,
      data: reportData,
      total: reportData.length
    })

  } catch (error) {
    console.error('[Report] By SKU error:', error)
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    })
  }
})

// ============================================================
// GET /api/report/by-date - Laporan per Tanggal
// ============================================================
router.get('/by-date', async (req, res) => {
  try {
    const { start_date, end_date } = req.query

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'Parameter start_date dan end_date wajib diisi'
      })
    }

    const { data: opnameData, error: opnameError } = await supabase
      .from(TABLES.OPNAME)
      .select('*')
      .gte('created_at', `${start_date}T00:00:00`)
      .lte('created_at', `${end_date}T23:59:59`)
      .order('created_at', { ascending: false })
      .limit(5000)

    if (opnameError) throw opnameError

    const skus = [...new Set(opnameData?.map((o: any) => o.sku) || [])]
    
    if (skus.length === 0) {
      return res.json({
        success: true,
        data: [],
        total: 0
      })
    }

    const { data: masterData, error: masterError } = await supabase
      .from(TABLES.MASTER)
      .select('*')
      .in('sku', skus)
      .limit(5000)

    if (masterError) throw masterError

    const reportData = opnameData?.map((item: any) => {
      const master = masterData?.find((m: any) => m.sku === item.sku && m.size === item.size)
      return {
        sku: item.sku,
        nama_barang: master?.nama_barang || 'Unknown',
        kategori: master?.kategori || 'Unknown',
        size: item.size || 'OS',
        stock_sistem: master?.stock_sistem || 0,
        stock_real: item.stock_real || 0,
        selisih: item.selisih || 0,
        status: item.status || 'belum',
        user_name: item.user_name || 'Petugas',
        created_at: item.created_at
      }
    }) || []

    res.json({
      success: true,
      data: reportData,
      total: reportData.length,
      range: {
        start: start_date,
        end: end_date
      }
    })

  } catch (error) {
    console.error('[Report] By date error:', error)
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    })
  }
})

export default router