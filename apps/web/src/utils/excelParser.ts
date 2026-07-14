import * as XLSX from 'xlsx-js-style'

export interface ParsedItem {
  sku: string
  nama_barang: string
  kategori: string
  warna: string
  size: string
  stock_sistem: number
}

// 👇 Size yang dikenali sebagai header kolom size
const KNOWN_SIZE_TOKENS = new Set([
  'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'ALL', 'NON', 'OS'
])

function isSizeToken(value: unknown): boolean {
  if (value === null || value === undefined) return false
  const s = String(value).trim().toUpperCase()
  if (!s) return false
  if (KNOWN_SIZE_TOKENS.has(s)) return true
  // Size angka (28-44 untuk celana/sepatu, dst) — range aman 20-50
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10)
    if (n >= 20 && n <= 50) return true
  }
  return false
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim()
    if (!cleaned) return null
    const parsed = parseFloat(cleaned)
    if (!isNaN(parsed)) return parsed
  }
  return null
}

interface IdentityCell {
  sku: string
  nama_barang: string
  kategori: string
  warna: string
}

// 👇 Deteksi cell gabungan "SKU , Nama Barang , Kategori , Warna"
// Contoh: "BL.BLO-XB053 , BX CHALK 02 , TSHIRT , BLACK"
function parseIdentityCell(value: unknown): IdentityCell | null {
  if (typeof value !== 'string') return null
  const commaCount = (value.match(/,/g) || []).length
  if (commaCount < 3) return null

  const parts = value.split(',').map(p => p.trim())
  if (parts.length < 4) return null

  const [sku, nama_barang, kategori, ...rest] = parts
  if (!sku || !nama_barang) return null

  return {
    sku,
    nama_barang,
    kategori: kategori || 'UNKNOWN',
    warna: rest.join(', ').trim() || 'N/A'
  }
}

/**
 * PARSER UTAMA — untuk format laporan pivot "INVENTORY BALANCING BY BRAND".
 *
 * Karakteristik file ini:
 * - Tiap baris data punya SATU cell gabungan "SKU , Nama Barang , Kategori , Warna"
 * - Kolom-kolom size (S, M, L, XL, XXL, 28, 30, dst) muncul di baris header
 *   TEPAT SEBELUM sekelompok baris data
 * - POSISI KOLOM size BISA BERUBAH-UBAH di dalam file yang sama (tiap section/
 *   brand punya layout kolom sendiri karena merged cells), jadi parser ini
 *   TIDAK boleh asumsi kolom tetap — selalu pakai baris header TERDEKAT di atas
 *   baris data sebagai acuan kolom size yang sedang berlaku.
 */
function parsePivotFormat(rows: unknown[][]): ParsedItem[] {
  const items: ParsedItem[] = []
  let headerMap: Record<number, string> = {}

  for (const row of rows) {
    if (!row || row.length === 0) continue

    // Cari cell identitas SKU di baris ini (posisi kolomnya boleh dimana aja)
    let identity: IdentityCell | null = null
    for (let c = 0; c < row.length; c++) {
      const parsed = parseIdentityCell(row[c])
      if (parsed) {
        identity = parsed
        break
      }
    }

    if (identity) {
      // Baris DATA. Kalau belum pernah nemu header size sama sekali, skip
      // (gak tau size-nya kolom mana)
      if (Object.keys(headerMap).length === 0) continue

      for (const colStr of Object.keys(headerMap)) {
        const col = Number(colStr)
        const size = headerMap[col]
        const stock = toNumber(row[col])

        if (stock !== null && stock > 0) {
          const exists = items.some(
            it => it.sku === identity!.sku && it.size === size
          )
          if (!exists) {
            items.push({
              sku: identity.sku,
              nama_barang: identity.nama_barang,
              kategori: identity.kategori,
              warna: identity.warna,
              size,
              stock_sistem: stock
            })
          }
        }
      }
    } else {
      // Bukan baris data — cek apakah ini baris HEADER SIZE
      // (minimal 2 cell yang isinya size token, misal "S", "M", "L"...)
      const candidateMap: Record<number, string> = {}
      for (let c = 0; c < row.length; c++) {
        if (isSizeToken(row[c])) {
          candidateMap[c] = String(row[c]).trim().toUpperCase()
        }
      }
      // Minimal 1 kolom size udah cukup jadi header baru — beberapa kategori
      // (WALLET, HAT, dll) cuma punya SATU kolom size (misal cuma "NON" atau "ALL"),
      // jadi threshold TIDAK BOLEH >=2 atau kategori itu bakal ke-skip / salah kolom.
      if (Object.keys(candidateMap).length >= 1) {
        headerMap = candidateMap
      }
    }
  }

  return items
}

/**
 * PARSER FALLBACK — format tabel sederhana dengan header eksplisit di baris
 * pertama yang mengandung "SKU" (kolom: SKU, Nama Barang, Kategori, Warna,
 * lalu kolom-kolom size / Total Stock).
 */
function parseSimpleTableFormat(rows: unknown[][]): ParsedItem[] {
  const items: ParsedItem[] = []

  const SIZE_COLUMNS = [
    'XS', 'S', 'M', 'L', 'XL', 'XXL',
    '28', '30', '32', '34', '36', '38', '39', '40', '41', '42', '43', '44',
    'ALL', 'NON'
  ]

  // Cari header row (baris yang berisi "SKU") dalam 20 baris pertama
  let headerRowIndex = -1
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const row = rows[i]
    if (!row) continue
    const firstCell = String(row[0] || '').trim()
    if (firstCell === 'SKU' || firstCell === 'sku') {
      headerRowIndex = i
      break
    }
  }

  if (headerRowIndex === -1) return items

  const headerRow = rows[headerRowIndex]
  const columnMap: Record<string, number> = {}
  for (let i = 0; i < headerRow.length; i++) {
    const cell = String(headerRow[i] || '').trim()
    if (cell) columnMap[cell] = i
  }

  const requiredColumns = ['SKU', 'Nama Barang', 'Kategori', 'Warna']
  for (const col of requiredColumns) {
    if (!(col in columnMap)) return items
  }

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]
    if (!row || row.length === 0) continue

    const sku = String(row[columnMap['SKU']] || '').trim()
    const nama = String(row[columnMap['Nama Barang']] || '').trim()
    const kategori = String(row[columnMap['Kategori']] || '').trim()
    const warna = String(row[columnMap['Warna']] || '').trim()

    if (!sku || !nama) continue

    let hasStock = false
    for (const size of SIZE_COLUMNS) {
      if (size in columnMap) {
        const colIndex = columnMap[size]
        const stock = toNumber(row[colIndex]) || 0

        if (stock > 0) {
          const existing = items.find(item => item.sku === sku && item.size === size)
          if (!existing) {
            items.push({
              sku,
              nama_barang: nama,
              kategori: kategori || 'UNKNOWN',
              warna: warna || 'N/A',
              size,
              stock_sistem: stock
            })
            hasStock = true
          }
        }
      }
    }

    if (!hasStock && 'Total Stock' in columnMap) {
      const colIndex = columnMap['Total Stock']
      const totalStock = toNumber(row[colIndex]) || 0

      if (totalStock > 0) {
        const size = 'ALL'
        const existing = items.find(item => item.sku === sku && item.size === size)
        if (!existing) {
          items.push({
            sku,
            nama_barang: nama,
            kategori: kategori || 'UNKNOWN',
            warna: warna || 'N/A',
            size,
            stock_sistem: totalStock
          })
        }
      }
    }
  }

  return items
}

export async function parseExcelFile(file: File): Promise<ParsedItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

        console.log('[parseExcelFile] Total rows:', rows.length)

        // 1) Coba format tabel sederhana dulu (ada header eksplisit "SKU")
        let items = parseSimpleTableFormat(rows)
        console.log('[parseExcelFile] Hasil format tabel sederhana:', items.length)

        // 2) Kalau kosong, coba format pivot "INVENTORY BALANCING BY BRAND"
        if (items.length === 0) {
          console.log('[parseExcelFile] Coba format pivot (INVENTORY BALANCING BY BRAND)...')
          items = parsePivotFormat(rows)
          console.log('[parseExcelFile] Hasil format pivot:', items.length)
        }

        // Sorting items berdasarkan SKU dan Size
        items.sort((a, b) => {
          if (a.sku < b.sku) return -1
          if (a.sku > b.sku) return 1
          return a.size.localeCompare(b.size)
        })

        console.log('[parseExcelFile] Parsed items:', items.length)
        console.log('[parseExcelFile] Sample (first 10):', items.slice(0, 10))

        resolve(items)
      } catch (error) {
        console.error('[parseExcelFile] Error:', error)
        reject(new Error(`Failed to parse Excel: ${(error as Error).message}`))
      }
    }

    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }

    reader.readAsArrayBuffer(file)
  })
}

export function validateItems(items: ParsedItem[]): { valid: boolean; errors: string[]; count: number } {
  const errors: string[] = []
  const skuSet = new Set<string>()

  for (const [index, item] of items.entries()) {
    if (!item.sku) {
      errors.push(`Row ${index + 1}: SKU is required`)
    }
    const key = `${item.sku}-${item.size}`
    if (skuSet.has(key)) {
      errors.push(`Row ${index + 1}: Duplicate SKU "${item.sku}" with size "${item.size}"`)
    }
    skuSet.add(key)

    if (!item.nama_barang) {
      errors.push(`Row ${index + 1}: Nama barang is required`)
    }
    if (item.stock_sistem < 0) {
      errors.push(`Row ${index + 1}: Stock cannot be negative`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    count: items.length
  }
}
