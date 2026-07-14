// apps/api/src/routes/products.ts
import { Router } from 'express'
import { supabase, TABLES } from '../supabase/client.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    let allData: any[] = []
    let from = 0
    const batchSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabase
        .from(TABLES.MASTER)
        .select('*')
        .order('nama_barang', { ascending: true })
        .range(from, from + batchSize - 1)

      if (error) throw error

      if (!data || data.length === 0) {
        hasMore = false
      } else {
        allData = allData.concat(data)
        from += data.length
      }
    }

    // 👇 TAMBAHIN: ambil semua data opname, lalu merge ke master
    const { data: opnameData, error: opnameError } = await supabase
      .from(TABLES.OPNAME)
      .select('sku, size, stock_real, selisih, status')

    if (opnameError) throw opnameError

    const opnameMap = new Map<string, any>()
    opnameData?.forEach((o: any) => {
      opnameMap.set(`${o.sku}__${o.size}`, o)
    })

    const merged = allData.map((product: any) => {
      const key = `${product.sku}__${product.size}`
      const opname = opnameMap.get(key)
      return {
        ...product,
        qty_fisik: opname ? opname.stock_real : null,
        selisih: opname ? opname.selisih : null,
        opname_status: opname ? opname.status : null,
      }
    })

    console.log(`[Products] Total loaded: ${merged.length}, matched opname: ${opnameMap.size}`)

    res.json({ 
      success: true, 
      data: merged,
      total: merged.length
    })
  } catch (error) {
    console.error('[Products] Error:', error)
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    })
  }
})

router.get('/:sku', async (req, res) => {
  try {
    const { sku } = req.params
    
    const { data, error } = await supabase
      .from(TABLES.MASTER)
      .select('*')
      .eq('sku', sku)

    if (error) throw error

    res.json({ 
      success: true, 
      data: data || []
    })
  } catch (error) {
    console.error('[Products] Error:', error)
    res.status(500).json({ 
      success: false, 
      error: (error as Error).message 
    })
  }
})

export default router