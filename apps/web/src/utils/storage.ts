// src/utils/storage.ts

const STORAGE_KEYS = {
  MASTER: 'opname_master_data',
  BARCODE: 'opname_barcode_mapping',
  OPNAME: 'opname_opname_results'
}

// ============================================================
// MASTER DATA
// ============================================================
export function saveMasterData(data: any[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.MASTER, JSON.stringify(data))
  } catch (error) {
    console.error('Failed to save master data:', error)
  }
}

export function getMasterData(): any[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.MASTER)
    return data ? JSON.parse(data) : []
  } catch (error) {
    console.error('Failed to get master data:', error)
    return []
  }
}

export function getMasterDataBySku(sku: string): any | null {
  const data = getMasterData()
  return data.find(item => item.sku === sku) || null
}

// ============================================================
// BARCODE MAPPING
// ============================================================
export function saveBarcodeMapping(sku: string, barcode: string) {
  try {
    const mappings = getBarcodeMappings()
    // Cek apakah barcode udah ada
    const existing = mappings.findIndex(m => m.barcode === barcode)
    if (existing >= 0) {
      mappings[existing] = { sku, barcode, created_at: new Date().toISOString() }
    } else {
      mappings.push({ sku, barcode, created_at: new Date().toISOString() })
    }
    localStorage.setItem(STORAGE_KEYS.BARCODE, JSON.stringify(mappings))
  } catch (error) {
    console.error('Failed to save barcode mapping:', error)
  }
}

export function getBarcodeMappings(): { sku: string; barcode: string; created_at: string }[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.BARCODE)
    return data ? JSON.parse(data) : []
  } catch (error) {
    console.error('Failed to get barcode mappings:', error)
    return []
  }
}

export function getBarcodeBySku(sku: string): string | null {
  const mappings = getBarcodeMappings()
  const found = mappings.find(m => m.sku === sku)
  return found ? found.barcode : null
}

export function getSkuByBarcode(barcode: string): string | null {
  const mappings = getBarcodeMappings()
  const found = mappings.find(m => m.barcode === barcode)
  return found ? found.sku : null
}

// ============================================================
// OPNAME RESULTS
// ============================================================
export function saveOpnameResult(data: any) {
  try {
    const results = getOpnameResults()
    // Cek apakah sku udah ada
    const existing = results.findIndex(r => r.sku === data.sku)
    if (existing >= 0) {
      results[existing] = { ...results[existing], ...data }
    } else {
      results.push(data)
    }
    localStorage.setItem(STORAGE_KEYS.OPNAME, JSON.stringify(results))
  } catch (error) {
    console.error('Failed to save opname result:', error)
  }
}

export function getOpnameResults(): any[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.OPNAME)
    return data ? JSON.parse(data) : []
  } catch (error) {
    console.error('Failed to get opname results:', error)
    return []
  }
}

export function getOpnameBySku(sku: string): any | null {
  const results = getOpnameResults()
  return results.find(r => r.sku === sku) || null
}

// ============================================================
// CLEAR DATA
// ============================================================
export function clearAllData() {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key)
    })
  } catch (error) {
    console.error('Failed to clear data:', error)
  }
}

// ============================================================
// EXPORT DATA
// ============================================================
export function exportAllData() {
  return {
    master: getMasterData(),
    barcode: getBarcodeMappings(),
    opname: getOpnameResults()
  }
}

// ============================================================
// GET STATS
// ============================================================
export function getDataStats() {
  const master = getMasterData()
  const barcode = getBarcodeMappings()
  const opname = getOpnameResults()
  
  return {
    totalItems: master.length,
    totalBarcodes: barcode.length,
    totalOpnames: opname.length,
    itemsWithStock: master.filter((item: any) => item.stock_sistem > 0).length
  }
}