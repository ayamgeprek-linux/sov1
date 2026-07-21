import React, { useState, useMemo, useRef } from 'react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/contexts/AuthContext'
import styles from './MasterPage.module.css'

interface Product {
  id: string
  sku: string
  nama_barang: string
  kategori: string
  warna: string
  size: string
  stock_sistem: number
  status_mapping?: boolean
  lokasi_rak?: string | null // 🔥 BARU
}

interface MasterPageProps {
  products: Product[]
  navigateTo: (page: string) => void
  showToast: (msg: string) => void
  refreshProducts?: () => void
}

export function MasterPage({ products, navigateTo, showToast, refreshProducts }: MasterPageProps) {
  const { token } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [kategoriFilter, setKategoriFilter] = useState('')
  const [sizeFilter, setSizeFilter] = useState('')
  const [rakFilter, setRakFilter] = useState('') // 🔥 BARU
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get unique categories, sizes, and rak
  const categories = useMemo(() => {
    return [...new Set(products.map(p => p.kategori))].filter(Boolean)
  }, [products])

  const sizes = useMemo(() => {
    return [...new Set(products.map(p => p.size))].filter(Boolean).sort()
  }, [products])

  const raks = useMemo(() => {
    const rakList = [...new Set(products.map(p => p.lokasi_rak))].filter(Boolean)
    return rakList.sort() as string[]
  }, [products])

  // Filter products
  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.nama_barang.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase())
      const matchKategori = !kategoriFilter || p.kategori === kategoriFilter
      const matchSize = !sizeFilter || p.size === sizeFilter
      const matchRak = !rakFilter || p.lokasi_rak === rakFilter
      return matchSearch && matchKategori && matchSize && matchRak
    })
  }, [products, searchTerm, kategoriFilter, sizeFilter, rakFilter])

  // Stats
  const mappedCount = products.filter(p => p.status_mapping).length
  const mappedPercentage = products.length > 0 ? Math.round((mappedCount / products.length) * 100) : 0
  const totalCategories = categories.length
  const totalRaks = raks.length

  const getCategoryBadgeClass = (kategori: string) => {
    const upper = kategori?.toUpperCase() || ''
    if (upper.includes('ACCESSORIES')) return styles.accessories
    if (upper.includes('BAG')) return styles.bag
    if (upper.includes('JAKET')) return styles.jaket
    if (upper.includes('CELANA')) return styles.celana
    if (upper.includes('TAS')) return styles.tas
    return styles.default
  }

  const handleMapClick = (product: Product) => {
    navigateTo('mapping')
    showToast(`Silahkan mapping barcode untuk: ${product.nama_barang} (${product.sku})`)
  }

  // ============================================================
  // IMPORT EXCEL
  // ============================================================
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const result = await api.post<{ success: boolean; message?: string; error?: string }>(
        '/api/import',
        formData,
        token || undefined
      )

      if (result?.success) {
        showToast(`✅ ${result.message || 'Import berhasil!'}`)
        if (refreshProducts) refreshProducts()
      } else {
        showToast(`❌ ${result?.error || 'Gagal import'}`)
      }
    } catch (error) {
      console.error('[Master] Import error:', error)
      showToast('❌ Gagal import: ' + (error as Error).message)
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleAddClick = () => {
    showToast('Fitur tambah barang sedang dalam pengembangan')
  }

  return (
    <div className={styles.masterPage}>
      {/* Page Header & Filters */}
      <div className={styles.masterHeader}>
        <div className={styles.masterHeaderTop}>
          <h1 className={styles.masterTitle}>Data Master Barang</h1>
          <p className={styles.masterSubtitle}>Manage and audit your product catalog with precision.</p>
        </div>

        <div className={styles.masterControls}>
          {/* Search Bar */}
          <div className={styles.masterSearch}>
            <input
              type="text"
              placeholder="Cari SKU / Nama..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <div className={styles.masterFilterWrapper}>
            <select 
              className={styles.masterFilter} 
              value={kategoriFilter} 
              onChange={(e) => setKategoriFilter(e.target.value)}
            >
              <option value="">Semua Kategori</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Size Filter */}
          <div className={styles.masterFilterWrapper}>
            <select 
              className={styles.masterFilter} 
              value={sizeFilter} 
              onChange={(e) => setSizeFilter(e.target.value)}
            >
              <option value="">Semua Size</option>
              {sizes.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* 🔥 RAK Filter */}
          <div className={styles.masterFilterWrapper}>
            <select 
              className={styles.masterFilter} 
              value={rakFilter} 
              onChange={(e) => setRakFilter(e.target.value)}
            >
              <option value="">Semua Rak</option>
              {raks.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 🔥 Stats Bar */}
        <div className={styles.masterStatsBar}>
          <div className={styles.masterStatItem}>
            <span className={styles.masterStatLabel}>Total Produk</span>
            <span className={styles.masterStatValue}>{products.length}</span>
          </div>
          <div className={styles.masterStatItem}>
            <span className={styles.masterStatLabel}>Total Kategori</span>
            <span className={styles.masterStatValue}>{totalCategories}</span>
          </div>
          <div className={styles.masterStatItem}>
            <span className={styles.masterStatLabel}>Total Rak</span>
            <span className={styles.masterStatValue}>{totalRaks}</span>
          </div>
          <div className={styles.masterStatItem}>
            <span className={styles.masterStatLabel}>Mapping</span>
            <span className={`${styles.masterStatValue} ${mappedPercentage > 70 ? styles.textGreen : styles.textOrange}`}>
              {mappedPercentage}%
            </span>
          </div>
          <div className={styles.masterStatItem}>
            <button 
              className={styles.masterImportBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              <span className="material-symbols-outlined">upload_file</span>
              {loading ? '...' : 'Import Excel'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className={styles.masterTableWrap}>
        <div className={styles.masterTableScroll}>
          <table className={styles.masterTable}>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Nama Barang</th>
                <th>Kategori</th>
                <th>Warna</th>
                <th className={styles.textCenter}>Size</th>
                <th className={styles.textCenter}>Stock</th>
                <th className={styles.textCenter}>Rak</th> {/* 🔥 BARU */}
                <th className={styles.textRight}>Mapping</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.emptyState}>
                    {products.length === 0 ? 
                      '📂 Belum ada data. Import data master terlebih dahulu.' : 
                      '🔍 Tidak ada data yang cocok dengan filter'
                    }
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={`${p.sku}-${p.size}`} className={styles.masterRow}>
                    <td className={`${styles.fontMono} ${styles.textXs}`}>{p.sku}</td>
                    <td>{p.nama_barang}</td>
                    <td>
                      <span className={`${styles.categoryBadge} ${getCategoryBadgeClass(p.kategori)}`}>
                        {p.kategori || 'UNKNOWN'}
                      </span>
                    </td>
                    <td className={styles.textXs}>{p.warna || '-'}</td>
                    <td className={styles.textCenter}>
                      <span className={styles.sizeLabel}>{p.size || 'OS'}</span>
                    </td>
                    <td className={`${styles.textCenter} ${styles.fontMono}`}>
                      {p.stock_sistem}
                    </td>
                    <td className={styles.textCenter}>
                      {p.lokasi_rak ? (
                        <span className={styles.rakBadge}>
                          <span className="material-symbols-outlined">inventory_2</span>
                          {p.lokasi_rak}
                        </span>
                      ) : (
                        <span className={styles.rakEmpty}>-</span>
                      )}
                    </td>
                    <td className={styles.textRight}>
                      {p.status_mapping ? (
                        <span className={`${styles.status} ${styles.mapped}`}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check</span>
                          MAPPED
                        </span>
                      ) : (
                        <span 
                          className={`${styles.status} ${styles.unmapped}`} 
                          onClick={() => handleMapClick(p)}
                        >
                          MAP
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className={styles.masterFooter}>
          <span className={styles.masterTotal}>
            Showing <strong>{filtered.length}</strong> of <strong>{products.length}</strong> items
          </span>
          <div className={styles.masterFooterActions}>
            <button className={styles.masterExportBtn} onClick={() => showToast('📥 Export CSV')}>
              <span className="material-symbols-outlined">download</span>
              Export
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}