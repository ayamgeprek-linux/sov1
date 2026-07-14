// src/utils/storage.ts

// Key untuk localStorage
const STORAGE_KEYS = {
  MASTER: 'opname_master_data',
  BARCODE: 'opname_barcode_mapping',
  OPNAME: 'opname_opname_results',
  HISTORY: 'opname_history'
}

// Simpan data master
export function saveMasterData(data: any[]) {
  localStorage.setItem(STORAGE_KEYS.MASTER, JSON.stringify(data))
}

// Ambil data master
export function getMasterData() {
  const data = localStorage.getItem(STORAGE_KEYS.MASTER)
  return data ? JSON.parse(data) : []
}

// Simpan mapping barcode
export function saveBarcodeMapping(sku: string, barcode: string) {
  const mappings = getBarcodeMappings()
  mappings.push({ sku, barcode, created_at: new Date().toISOString() })
  localStorage.setItem(STORAGE_KEYS.BARCODE, JSON.stringify(mappings))
}

// Ambil mapping barcode
export function getBarcodeMappings() {
  const data = localStorage.getItem(STORAGE_KEYS.BARCODE)
  return data ? JSON.parse(data) : []
}

// Simpan hasil opname
export function saveOpnameResult(data: any) {
  const results = getOpnameResults()
  results.push(data)
  localStorage.setItem(STORAGE_KEYS.OPNAME, JSON.stringify(results))
}

// Ambil hasil opname
export function getOpnameResults() {
  const data = localStorage.getItem(STORAGE_KEYS.OPNAME)
  return data ? JSON.parse(data) : []
}

// Hapus semua data
export function clearAllData() {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key)
  })
}